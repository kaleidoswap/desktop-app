//! Remote brain: serve the desktop's loaded KaleidoMind model to a paired phone
//! over an OpenAI-compatible HTTP API.
//!
//! Only raw model inference is exposed (`GET /v1/models`,
//! `POST /v1/chat/completions` with streaming and tool definitions passed
//! through). The desktop never executes tools for a remote caller and never
//! exposes its wallet, MCP servers, skills or keys: requests are forwarded to
//! the sidecar's tool-less `complete` command, never to the agentic `chat`.
//!
//! Security posture: off by default; binds 127.0.0.1 unless the user opts into
//! LAN mode (then binds the LAN address only); every request needs the bearer
//! token (256-bit, rotatable); peers outside loopback/private ranges, browser
//! requests (any `Origin` header) and over-limit clients are rejected; one
//! inference at a time; 1 MiB body cap. Transport is plain HTTP — see the PR
//! for the LAN risk discussion.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use axum::extract::{ConnectInfo, DefaultBodyLimit, Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine as _;
use futures::StreamExt;
use parking_lot::{Mutex, RwLock};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::{broadcast, mpsc, oneshot, Semaphore};

use crate::mind::{MindProcess, INTERNAL_ID_PREFIX};

pub const DEFAULT_PORT: u16 = 47615;
const CONFIG_FILE: &str = "remote_brain.json";
const MAX_BODY_BYTES: usize = 1024 * 1024;
const MAX_MESSAGES: usize = 256;
const MAX_TOOLS: usize = 64;
const MAX_OUTPUT_TOKENS: u64 = 4096;
const RPC_TIMEOUT: Duration = Duration::from_secs(10);
const COMPLETION_TIMEOUT: Duration = Duration::from_secs(300);
const QUEUE_TIMEOUT: Duration = Duration::from_secs(60);
const RATE_BURST: f64 = 30.0;
const RATE_PER_SEC: f64 = 0.5;

// ─── Sidecar access ────────────────────────────────────────────────────────

/// What the server needs from the KaleidoMind sidecar.
pub trait Sidecar: Send + Sync + 'static {
    fn is_running(&self) -> bool;
    fn send(&self, payload: &Value) -> Result<(), String>;
    fn subscribe(&self) -> broadcast::Receiver<Value>;
}

struct MindSidecar {
    app: AppHandle,
    mind: Arc<MindProcess>,
}

impl Sidecar for MindSidecar {
    fn is_running(&self) -> bool {
        self.mind.is_running()
    }
    fn send(&self, payload: &Value) -> Result<(), String> {
        self.mind.send(&self.app, payload)
    }
    fn subscribe(&self) -> broadcast::Receiver<Value> {
        self.mind.subscribe()
    }
}

// ─── Errors ────────────────────────────────────────────────────────────────

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    kind: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            kind,
            message: message.into(),
        }
    }
    fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_request_error", message)
    }
    fn unavailable(message: impl Into<String>) -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, "unavailable", message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({ "error": {
            "message": self.message,
            "type": self.kind,
            "param": Value::Null,
            "code": self.kind,
        } });
        (self.status, Json(body)).into_response()
    }
}

/// Map a sidecar error string to an HTTP error. mind-provider answers
/// `complete` with "QVAC model not loaded" when no model is running.
fn sidecar_error(message: String) -> ApiError {
    if message.to_ascii_lowercase().contains("model not loaded") {
        return ApiError::unavailable("no model is running on the desktop");
    }
    ApiError::new(StatusCode::BAD_GATEWAY, "inference_error", message)
}

// ─── Server state ──────────────────────────────────────────────────────────

struct Bucket {
    tokens: f64,
    last: Instant,
}

struct Shared {
    sidecar: Arc<dyn Sidecar>,
    token: Arc<RwLock<String>>,
    allow_lan: bool,
    limiter: Mutex<HashMap<IpAddr, Bucket>>,
    inference: Arc<Semaphore>,
    seq: AtomicU64,
}

impl Shared {
    fn new(sidecar: Arc<dyn Sidecar>, token: Arc<RwLock<String>>, allow_lan: bool) -> Self {
        Self {
            sidecar,
            token,
            allow_lan,
            limiter: Mutex::new(HashMap::new()),
            inference: Arc::new(Semaphore::new(1)),
            seq: AtomicU64::new(0),
        }
    }

    fn next_id(&self) -> String {
        format!(
            "{}{}-{}",
            INTERNAL_ID_PREFIX,
            std::process::id(),
            self.seq.fetch_add(1, Ordering::Relaxed)
        )
    }

    fn take_rate_token(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut map = self.limiter.lock();
        if map.len() > 1024 {
            map.retain(|_, b| now.duration_since(b.last) < Duration::from_secs(120));
        }
        let bucket = map.entry(ip).or_insert(Bucket {
            tokens: RATE_BURST,
            last: now,
        });
        let refill = now.duration_since(bucket.last).as_secs_f64() * RATE_PER_SEC;
        bucket.tokens = (bucket.tokens + refill).min(RATE_BURST);
        bucket.last = now;
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Send one command to the sidecar and wait for its `response`, forwarding
    /// `completion_delta` text for that id to `deltas`.
    async fn call(
        &self,
        id: &str,
        cmd: Value,
        deltas: Option<&mpsc::UnboundedSender<String>>,
        timeout: Duration,
    ) -> Result<Value, ApiError> {
        if !self.sidecar.is_running() {
            return Err(ApiError::unavailable(
                "the KaleidoMind runtime is not running",
            ));
        }
        let mut rx = self.sidecar.subscribe();
        self.sidecar.send(&cmd).map_err(ApiError::unavailable)?;
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let event = match tokio::time::timeout_at(deadline, rx.recv()).await {
                Err(_) => {
                    return Err(ApiError::new(
                        StatusCode::GATEWAY_TIMEOUT,
                        "timeout",
                        "the desktop model did not answer in time",
                    ))
                }
                Ok(Err(broadcast::error::RecvError::Lagged(_))) => continue,
                Ok(Err(broadcast::error::RecvError::Closed)) => {
                    return Err(ApiError::unavailable("the KaleidoMind runtime stopped"))
                }
                Ok(Ok(v)) => v,
            };
            if event.get("id").and_then(Value::as_str) != Some(id) {
                continue;
            }
            match event.get("type").and_then(Value::as_str) {
                Some("completion_delta") => {
                    if let (Some(tx), Some(d)) =
                        (deltas, event.get("delta").and_then(Value::as_str))
                    {
                        if tx.send(d.to_string()).is_err() {
                            return Err(ApiError::new(
                                StatusCode::BAD_REQUEST,
                                "cancelled",
                                "client went away",
                            ));
                        }
                    }
                }
                Some("response") => {
                    return if event.get("ok").and_then(Value::as_bool) == Some(true) {
                        Ok(event.get("data").cloned().unwrap_or(Value::Null))
                    } else {
                        Err(sidecar_error(
                            event
                                .get("error")
                                .and_then(Value::as_str)
                                .unwrap_or("inference failed")
                                .to_string(),
                        ))
                    };
                }
                _ => {}
            }
        }
    }

    /// The loaded model id, or 503 when the brain is offline.
    async fn active_model(&self) -> Result<String, ApiError> {
        let id = self.next_id();
        let status = self
            .call(
                &id,
                json!({ "id": id, "cmd": "get_status" }),
                None,
                RPC_TIMEOUT,
            )
            .await?;
        if status.get("on").and_then(Value::as_bool) != Some(true) {
            return Err(ApiError::unavailable("no model is running on the desktop"));
        }
        Ok(status
            .get("activeModelId")
            .and_then(Value::as_str)
            .unwrap_or("kaleidomind")
            .to_string())
    }
}

/// Cancels an in-flight completion if the request is dropped before it ends.
struct CancelOnDrop {
    sidecar: Arc<dyn Sidecar>,
    id: String,
    armed: bool,
}

impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        if self.armed {
            let _ = self.sidecar.send(&json!({
                "id": format!("{}-cancel", self.id),
                "cmd": "cancel_completion",
                "target": self.id,
            }));
        }
    }
}

// ─── Access control ────────────────────────────────────────────────────────

/// Loopback always; private/link-local LAN ranges only in LAN mode.
pub fn peer_allowed(ip: IpAddr, allow_lan: bool) -> bool {
    let ip = match ip {
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .map(IpAddr::V4)
            .unwrap_or(IpAddr::V6(v6)),
        v4 => v4,
    };
    if ip.is_loopback() {
        return true;
    }
    if !allow_lan {
        return false;
    }
    match ip {
        IpAddr::V4(v4) => v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            let first = v6.segments()[0];
            (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
        }
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn bearer_ok(headers: &HeaderMap, expected: &str) -> bool {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .is_some_and(|t| {
            !expected.is_empty() && constant_time_eq(t.trim().as_bytes(), expected.as_bytes())
        })
}

async fn guard(State(shared): State<Arc<Shared>>, req: Request, next: Next) -> Response {
    let peer = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0.ip());
    let Some(ip) = peer.filter(|ip| peer_allowed(*ip, shared.allow_lan)) else {
        return ApiError::new(StatusCode::FORBIDDEN, "forbidden", "address not allowed")
            .into_response();
    };
    if !shared.take_rate_token(ip) {
        return ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            "too many requests",
        )
        .into_response();
    }
    // Native clients send no Origin; any browser page (incl. DNS rebinding) does.
    if req.headers().contains_key(header::ORIGIN) {
        return ApiError::new(
            StatusCode::FORBIDDEN,
            "forbidden",
            "browser requests are not allowed",
        )
        .into_response();
    }
    if !bearer_ok(req.headers(), &shared.token.read()) {
        let mut res = ApiError::new(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "missing or invalid token",
        )
        .into_response();
        res.headers_mut().insert(
            header::WWW_AUTHENTICATE,
            header::HeaderValue::from_static("Bearer"),
        );
        return res;
    }
    let mut res = next.run(req).await;
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    res
}

// ─── OpenAI ⇄ sidecar translation ──────────────────────────────────────────

fn content_text(content: Option<&Value>) -> Result<String, String> {
    match content {
        None | Some(Value::Null) => Ok(String::new()),
        Some(Value::String(s)) => Ok(s.clone()),
        Some(Value::Array(parts)) => {
            let mut out = String::new();
            for part in parts {
                match part.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        out.push_str(part.get("text").and_then(Value::as_str).unwrap_or(""))
                    }
                    other => {
                        return Err(format!(
                            "unsupported content part: {}",
                            other.unwrap_or("?")
                        ))
                    }
                }
            }
            Ok(out)
        }
        Some(_) => Err("message content must be a string or text parts".into()),
    }
}

/// OpenAI messages → the engine's history format (tool calls encoded as
/// `<tool_call>` blocks in assistant content, as `@kaleidorg/mind` stores them).
fn to_engine_messages(messages: &[Value]) -> Result<Vec<Value>, String> {
    if messages.is_empty() {
        return Err("messages must not be empty".into());
    }
    if messages.len() > MAX_MESSAGES {
        return Err(format!("at most {} messages are allowed", MAX_MESSAGES));
    }
    messages
        .iter()
        .map(|m| {
            let role = m.get("role").and_then(Value::as_str).unwrap_or("");
            let text = content_text(m.get("content"))?;
            match role {
                "system" | "developer" => Ok(json!({ "role": "system", "content": text })),
                "user" => Ok(json!({ "role": "user", "content": text })),
                "tool" => Ok(json!({ "role": "tool", "content": text })),
                "assistant" => {
                    let mut parts = vec![text.trim().to_string()];
                    for call in m
                        .get("tool_calls")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                    {
                        let f = call.get("function").ok_or("tool call without function")?;
                        let name = f
                            .get("name")
                            .and_then(Value::as_str)
                            .ok_or("tool call without name")?;
                        let args = match f.get("arguments") {
                            Some(Value::String(s)) if !s.trim().is_empty() => {
                                serde_json::from_str(s).unwrap_or(json!({}))
                            }
                            Some(v @ Value::Object(_)) => v.clone(),
                            _ => json!({}),
                        };
                        parts.push(format!(
                            "<tool_call>{}</tool_call>",
                            json!({ "name": name, "arguments": args })
                        ));
                    }
                    parts.retain(|p| !p.is_empty());
                    Ok(json!({ "role": "assistant", "content": parts.join("\n") }))
                }
                other => Err(format!("unsupported role: {}", other)),
            }
        })
        .collect()
}

fn valid_tool_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// OpenAI `tools` → `{name, description, parameters}` definitions. The phone
/// owns and executes these; the desktop only lets the model see their schema.
fn to_engine_tools(tools: Option<&Value>) -> Result<Vec<Value>, String> {
    let Some(list) = tools.filter(|t| !t.is_null()) else {
        return Ok(vec![]);
    };
    let list = list.as_array().ok_or("tools must be an array")?;
    if list.len() > MAX_TOOLS {
        return Err(format!("at most {} tools are allowed", MAX_TOOLS));
    }
    list.iter()
        .map(|t| {
            if t.get("type").and_then(Value::as_str) != Some("function") {
                return Err("only function tools are supported".to_string());
            }
            let f = t.get("function").ok_or("tool without function")?;
            let name = f.get("name").and_then(Value::as_str).unwrap_or("");
            if !valid_tool_name(name) {
                return Err(format!("invalid tool name: {:?}", name));
            }
            let mut tool = json!({ "name": name });
            if let Some(d) = f.get("description").and_then(Value::as_str) {
                tool["description"] = json!(d);
            }
            if let Some(p) = f.get("parameters").filter(|p| p.is_object()) {
                tool["parameters"] = p.clone();
            }
            Ok(tool)
        })
        .collect()
}

fn to_tool_choice(choice: Option<&Value>) -> Result<Option<String>, String> {
    match choice {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) if matches!(s.as_str(), "auto" | "none" | "required") => {
            Ok(Some(s.clone()))
        }
        Some(v) => v
            .get("function")
            .and_then(|f| f.get("name"))
            .and_then(Value::as_str)
            .filter(|n| valid_tool_name(n))
            .map(|n| Some(n.to_string()))
            .ok_or_else(|| "invalid tool_choice".to_string()),
    }
}

/// Build the sidecar `complete` command for one OpenAI request body.
fn build_complete_command(id: &str, body: &Value) -> Result<Value, String> {
    let messages = body
        .get("messages")
        .and_then(Value::as_array)
        .ok_or("messages must be an array")?;
    let mut cmd = json!({
        "id": id,
        "cmd": "complete",
        "messages": to_engine_messages(messages)?,
    });
    let tools = to_engine_tools(body.get("tools"))?;
    if !tools.is_empty() {
        cmd["tools"] = json!(tools);
    }
    if let Some(choice) = to_tool_choice(body.get("tool_choice"))? {
        let named = !matches!(choice.as_str(), "auto" | "none" | "required");
        if named && !tools.iter().any(|t| t["name"] == choice.as_str()) {
            return Err(format!("tool_choice names an unknown tool: {}", choice));
        }
        if choice == "required" && tools.is_empty() {
            return Err("tool_choice \"required\" needs at least one tool".into());
        }
        cmd["toolChoice"] = json!(choice);
    }
    let max = body
        .get("max_completion_tokens")
        .or_else(|| body.get("max_tokens"))
        .and_then(Value::as_u64);
    if let Some(max) = max {
        cmd["maxTokens"] = json!(max.clamp(1, MAX_OUTPUT_TOKENS));
    }
    if let Some(t) = body.get("temperature").and_then(Value::as_f64) {
        cmd["temperature"] = json!(t.clamp(0.0, 2.0));
    }
    Ok(cmd)
}

fn openai_tool_calls(result: &Value) -> Vec<Value> {
    result
        .get("toolCalls")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
        .filter_map(|(i, c)| {
            let name = c.get("name").and_then(Value::as_str)?;
            let arguments = match c.get("arguments") {
                Some(Value::String(s)) => s.clone(),
                Some(v) if !v.is_null() => v.to_string(),
                _ => "{}".to_string(),
            };
            Some(json!({
                "id": c.get("id").and_then(Value::as_str).map(String::from).unwrap_or_else(|| format!("call_{}", i)),
                "type": "function",
                "function": { "name": name, "arguments": arguments },
            }))
        })
        .collect()
}

fn finish_reason(result: &Value, has_calls: bool) -> &'static str {
    if has_calls {
        "tool_calls"
    } else if result.pointer("/inference/status").and_then(Value::as_str) == Some("truncated") {
        "length"
    } else {
        "stop"
    }
}

fn usage(result: &Value) -> Value {
    let n = |k: &str| {
        result
            .pointer(&format!("/inference/{}", k))
            .and_then(Value::as_u64)
            .unwrap_or(0)
    };
    json!({
        "prompt_tokens": n("promptTokens"),
        "completion_tokens": n("completionTokens"),
        "total_tokens": n("totalTokens"),
    })
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn completion_body(id: &str, model: &str, created: u64, result: &Value) -> Value {
    let calls = openai_tool_calls(result);
    let text = result.get("text").and_then(Value::as_str).unwrap_or("");
    let mut message = json!({ "role": "assistant", "content": text });
    if !calls.is_empty() {
        if text.is_empty() {
            message["content"] = Value::Null;
        }
        message["tool_calls"] = json!(calls);
    }
    json!({
        "id": id,
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [{ "index": 0, "message": message, "finish_reason": finish_reason(result, !calls.is_empty()) }],
        "usage": usage(result),
    })
}

fn chunk(id: &str, model: &str, created: u64, delta: Value, finish: Option<&str>) -> Value {
    json!({
        "id": id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{ "index": 0, "delta": delta, "finish_reason": finish }],
    })
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async fn models(State(shared): State<Arc<Shared>>) -> Result<Json<Value>, ApiError> {
    let data = match shared.active_model().await {
        Ok(model) => vec![
            json!({ "id": model, "object": "model", "created": 0, "owned_by": "kaleidoswap-desktop" }),
        ],
        Err(e) if e.status == StatusCode::SERVICE_UNAVAILABLE => vec![],
        Err(e) => return Err(e),
    };
    Ok(Json(json!({ "object": "list", "data": data })))
}

enum StreamMsg {
    Delta(String),
    Done(Result<Value, ApiError>),
}

async fn chat_completions(
    State(shared): State<Arc<Shared>>,
    body: Result<Json<Value>, axum::extract::rejection::JsonRejection>,
) -> Result<Response, ApiError> {
    let Json(body) = body.map_err(|e| ApiError::bad_request(e.body_text()))?;
    let id = shared.next_id();
    let cmd = build_complete_command(&id, &body).map_err(ApiError::bad_request)?;
    let stream = body.get("stream").and_then(Value::as_bool) == Some(true);
    let include_usage = body
        .pointer("/stream_options/include_usage")
        .and_then(Value::as_bool)
        == Some(true);

    let model = shared.active_model().await?;
    let permit =
        match tokio::time::timeout(QUEUE_TIMEOUT, Arc::clone(&shared.inference).acquire_owned())
            .await
        {
            Ok(Ok(permit)) => permit,
            _ => {
                return Err(ApiError::unavailable(
                    "the desktop model is busy; try again",
                ))
            }
        };

    let created = unix_now();
    let response_id = format!("chatcmpl-{}", id.trim_start_matches(INTERNAL_ID_PREFIX));

    if !stream {
        let mut cancel = CancelOnDrop {
            sidecar: Arc::clone(&shared.sidecar),
            id: id.clone(),
            armed: true,
        };
        let result = shared.call(&id, cmd, None, COMPLETION_TIMEOUT).await;
        drop(permit);
        cancel.armed = result.is_err();
        let result = result?;
        return Ok(Json(completion_body(&response_id, &model, created, &result)).into_response());
    }

    let (tx, rx) = mpsc::unbounded_channel::<StreamMsg>();
    let task_shared = Arc::clone(&shared);
    tokio::spawn(async move {
        let _permit = permit;
        let (delta_tx, mut delta_rx) = mpsc::unbounded_channel::<String>();
        let forward_tx = tx.clone();
        let forward = tokio::spawn(async move {
            while let Some(d) = delta_rx.recv().await {
                if forward_tx.send(StreamMsg::Delta(d)).is_err() {
                    break;
                }
            }
        });
        let mut cancel = CancelOnDrop {
            sidecar: Arc::clone(&task_shared.sidecar),
            id: id.clone(),
            armed: true,
        };
        let result = tokio::select! {
            r = task_shared.call(&id, cmd, Some(&delta_tx), COMPLETION_TIMEOUT) => Some(r),
            _ = tx.closed() => None,
        };
        drop(delta_tx);
        let _ = forward.await;
        if let Some(result) = result {
            cancel.armed = result.is_err();
            let _ = tx.send(StreamMsg::Done(result));
        }
    });

    // The SSE body owns `rx`: when the client disconnects axum drops the body,
    // `tx.closed()` fires in the task above and the completion is cancelled.
    let sse = SseChunks {
        id: response_id,
        model,
        created,
        include_usage,
    };
    let head = sse.chunk(json!({ "role": "assistant", "content": "" }), None);
    let body = futures::stream::unfold(Some((rx, sse)), |state| async move {
        let (mut rx, sse) = state?;
        match rx.recv().await {
            Some(StreamMsg::Delta(d)) => Some((
                vec![sse.chunk(json!({ "content": d }), None)],
                Some((rx, sse)),
            )),
            Some(StreamMsg::Done(result)) => Some((sse.finish(result), None)),
            None => None,
        }
    });
    let events = futures::stream::once(async move { vec![head] })
        .chain(body)
        .chain(futures::stream::once(async { vec!["[DONE]".to_string()] }))
        .flat_map(|batch| {
            futures::stream::iter(
                batch
                    .into_iter()
                    .map(|s| Ok::<_, std::convert::Infallible>(Event::default().data(s))),
            )
        });
    Ok(Sse::new(events)
        .keep_alive(KeepAlive::default())
        .into_response())
}

/// Builds the `chat.completion.chunk` payloads of one streamed response.
struct SseChunks {
    id: String,
    model: String,
    created: u64,
    include_usage: bool,
}

impl SseChunks {
    fn chunk(&self, delta: Value, finish: Option<&str>) -> String {
        chunk(&self.id, &self.model, self.created, delta, finish).to_string()
    }

    /// Tool calls (if any), the finish chunk and optional usage; or an error.
    fn finish(&self, result: Result<Value, ApiError>) -> Vec<String> {
        let result = match result {
            Ok(r) => r,
            Err(e) => {
                return vec![json!({ "error": {
                    "message": e.message, "type": e.kind, "param": Value::Null, "code": e.kind,
                } })
                .to_string()]
            }
        };
        let mut out = vec![];
        let calls = openai_tool_calls(&result);
        let has_calls = !calls.is_empty();
        if has_calls {
            let indexed: Vec<Value> = calls
                .into_iter()
                .enumerate()
                .map(|(i, mut c)| {
                    c["index"] = json!(i);
                    c
                })
                .collect();
            out.push(self.chunk(json!({ "tool_calls": indexed }), None));
        }
        out.push(self.chunk(json!({}), Some(finish_reason(&result, has_calls))));
        if self.include_usage {
            let mut u = chunk(&self.id, &self.model, self.created, json!({}), None);
            u["choices"] = json!([]);
            u["usage"] = usage(&result);
            out.push(u.to_string());
        }
        out
    }
}

async fn not_found() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "not_found", "not found")
}

fn router(shared: Arc<Shared>) -> Router {
    Router::new()
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions))
        .fallback(not_found)
        .layer(middleware::from_fn_with_state(Arc::clone(&shared), guard))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(shared)
}

// ─── Config + lifecycle ────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBrainConfig {
    pub enabled: bool,
    pub lan: bool,
    pub port: u16,
    pub token: String,
}

impl Default for RemoteBrainConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            lan: false,
            port: DEFAULT_PORT,
            token: new_token(),
        }
    }
}

/// 256 random bits, base64url without padding.
pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// The machine's primary LAN address (route lookup only; no packet is sent).
pub fn lan_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if ip.is_private() || ip.is_link_local() => Some(ip),
        _ => None,
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBrainStatus {
    pub enabled: bool,
    pub running: bool,
    pub lan: bool,
    pub host: String,
    pub port: u16,
    pub token: String,
    pub lan_address: Option<String>,
    pub error: Option<String>,
}

struct Running {
    addr: SocketAddr,
    token: Arc<RwLock<String>>,
    shutdown: oneshot::Sender<()>,
}

#[derive(Default)]
pub struct RemoteBrain {
    state: tokio::sync::Mutex<RemoteBrainState>,
}

#[derive(Default)]
struct RemoteBrainState {
    config: Option<RemoteBrainConfig>,
    running: Option<Running>,
    error: Option<String>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(CONFIG_FILE))
}

fn load_config(app: &AppHandle) -> RemoteBrainConfig {
    config_path(app)
        .ok()
        .and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice::<RemoteBrainConfig>(&b).ok())
        .filter(|c| c.token.len() >= 32)
        .unwrap_or_default()
}

fn save_config(app: &AppHandle, config: &RemoteBrainConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let bytes = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Bind and serve; returns the bound address and a shutdown handle.
async fn serve(
    sidecar: Arc<dyn Sidecar>,
    bind: SocketAddr,
    token: Arc<RwLock<String>>,
    allow_lan: bool,
) -> Result<(SocketAddr, oneshot::Sender<()>), String> {
    let listener = tokio::net::TcpListener::bind(bind)
        .await
        .map_err(|e| format!("cannot listen on {}: {}", bind, e))?;
    let addr = listener.local_addr().map_err(|e| e.to_string())?;
    let app = router(Arc::new(Shared::new(sidecar, token, allow_lan)));
    let (tx, rx) = oneshot::channel::<()>();
    tokio::spawn(async move {
        let server = axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            let _ = rx.await;
        });
        if let Err(e) = server.await {
            log::warn!("[remote-brain] server stopped: {}", e);
        }
    });
    Ok((addr, tx))
}

impl RemoteBrain {
    fn status_of(state: &RemoteBrainState) -> RemoteBrainStatus {
        let config = state.config.clone().unwrap_or_default();
        let (host, port) = match &state.running {
            Some(r) => (r.addr.ip().to_string(), r.addr.port()),
            None => (
                if config.lan {
                    lan_ipv4().map(|ip| ip.to_string()).unwrap_or_default()
                } else {
                    Ipv4Addr::LOCALHOST.to_string()
                },
                config.port,
            ),
        };
        RemoteBrainStatus {
            enabled: config.enabled,
            running: state.running.is_some(),
            lan: config.lan,
            host,
            port,
            token: config.token,
            lan_address: lan_ipv4().map(|ip| ip.to_string()),
            error: state.error.clone(),
        }
    }

    async fn apply(&self, app: &AppHandle, state: &mut RemoteBrainState) {
        if let Some(running) = state.running.take() {
            let _ = running.shutdown.send(());
        }
        state.error = None;
        let config = state.config.clone().unwrap_or_default();
        if !config.enabled {
            return;
        }
        let ip = if config.lan {
            match lan_ipv4() {
                Some(ip) => IpAddr::V4(ip),
                None => {
                    state.error = Some("no LAN address found".into());
                    return;
                }
            }
        } else {
            IpAddr::V4(Ipv4Addr::LOCALHOST)
        };
        let Some(mind) = app.try_state::<Arc<MindProcess>>() else {
            state.error = Some("KaleidoMind is not available".into());
            return;
        };
        let sidecar: Arc<dyn Sidecar> = Arc::new(MindSidecar {
            app: app.clone(),
            mind: Arc::clone(&mind),
        });
        let token = Arc::new(RwLock::new(config.token.clone()));
        match serve(
            sidecar,
            SocketAddr::new(ip, config.port),
            Arc::clone(&token),
            config.lan,
        )
        .await
        {
            Ok((addr, shutdown)) => {
                log::info!("[remote-brain] serving on http://{}/v1", addr);
                state.running = Some(Running {
                    addr,
                    token,
                    shutdown,
                });
            }
            Err(e) => {
                log::warn!("[remote-brain] {}", e);
                state.error = Some(e);
            }
        }
    }

    /// Start the server at launch if the user left it enabled.
    pub async fn restore(&self, app: &AppHandle) {
        let mut state = self.state.lock().await;
        state.config = Some(load_config(app));
        if state.config.as_ref().is_some_and(|c| c.enabled) {
            self.apply(app, &mut state).await;
        }
    }
}

fn ensure_loaded(app: &AppHandle, state: &mut RemoteBrainState) -> RemoteBrainConfig {
    state.config.get_or_insert_with(|| load_config(app)).clone()
}

#[tauri::command]
pub async fn remote_brain_status(
    app: AppHandle,
    rb: tauri::State<'_, Arc<RemoteBrain>>,
) -> Result<RemoteBrainStatus, String> {
    let mut state = rb.state.lock().await;
    ensure_loaded(&app, &mut state);
    Ok(RemoteBrain::status_of(&state))
}

#[tauri::command]
pub async fn remote_brain_configure(
    app: AppHandle,
    rb: tauri::State<'_, Arc<RemoteBrain>>,
    enabled: bool,
    lan: bool,
) -> Result<RemoteBrainStatus, String> {
    let mut state = rb.state.lock().await;
    let mut config = ensure_loaded(&app, &mut state);
    config.enabled = enabled;
    config.lan = lan;
    save_config(&app, &config)?;
    state.config = Some(config);
    rb.apply(&app, &mut state).await;
    Ok(RemoteBrain::status_of(&state))
}

/// New token; takes effect immediately and invalidates every paired phone.
#[tauri::command]
pub async fn remote_brain_rotate_token(
    app: AppHandle,
    rb: tauri::State<'_, Arc<RemoteBrain>>,
) -> Result<RemoteBrainStatus, String> {
    let mut state = rb.state.lock().await;
    let mut config = ensure_loaded(&app, &mut state);
    config.token = new_token();
    save_config(&app, &config)?;
    if let Some(running) = &state.running {
        *running.token.write() = config.token.clone();
    }
    state.config = Some(config);
    Ok(RemoteBrain::status_of(&state))
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv6Addr;

    /// Fake sidecar speaking mind-provider 0.10.1's `complete` contract. A user
    /// message "slow" streams one delta, then waits for `cancel_completion`.
    struct FakeSidecar {
        tx: broadcast::Sender<Value>,
        on: bool,
        loaded: bool,
        sent: Mutex<Vec<Value>>,
        pending: Mutex<HashMap<String, oneshot::Sender<()>>>,
    }

    impl FakeSidecar {
        fn new(on: bool, loaded: bool) -> Arc<Self> {
            let (tx, _) = broadcast::channel(64);
            Arc::new(Self {
                tx,
                on,
                loaded,
                sent: Mutex::new(vec![]),
                pending: Mutex::new(HashMap::new()),
            })
        }

        fn cmds(&self) -> Vec<String> {
            self.sent
                .lock()
                .iter()
                .map(|c| c["cmd"].as_str().unwrap_or("").to_string())
                .collect()
        }
    }

    fn inference(status: &str, prompt: u64, completion: u64) -> Value {
        json!({ "status": status, "durationMs": 1, "promptTokens": prompt,
                "completionTokens": completion, "totalTokens": prompt + completion })
    }

    impl Sidecar for FakeSidecar {
        fn is_running(&self) -> bool {
            true
        }
        fn send(&self, payload: &Value) -> Result<(), String> {
            self.sent.lock().push(payload.clone());
            let id = payload["id"].as_str().unwrap_or("").to_string();
            let tx = self.tx.clone();
            let cmd = payload["cmd"].as_str().unwrap_or("").to_string();
            if cmd == "cancel_completion" {
                if let Some(stop) = self
                    .pending
                    .lock()
                    .remove(payload["target"].as_str().unwrap_or(""))
                {
                    let _ = stop.send(());
                }
                let _ = tx.send(json!({ "type": "response", "id": id, "ok": true }));
                return Ok(());
            }
            let (on, loaded) = (self.on, self.loaded);
            let has_tools = payload["tools"].as_array().is_some_and(|t| !t.is_empty());
            let slow = payload["messages"]
                .as_array()
                .and_then(|m| m.last())
                .is_some_and(|m| m["content"] == "slow");
            let cancelled = if cmd == "complete" && slow {
                let (stop_tx, stop_rx) = oneshot::channel();
                self.pending.lock().insert(id.clone(), stop_tx);
                Some(stop_rx)
            } else {
                None
            };
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(5)).await;
                let reply = match cmd.as_str() {
                    "get_status" => json!({ "type": "response", "id": id, "ok": true,
                        "data": { "on": on, "activeModelId": "qwen3.5-2b" } }),
                    "complete" if !loaded => {
                        json!({ "type": "response", "id": id, "ok": false, "error": "QVAC model not loaded" })
                    }
                    "complete" if cancelled.is_some() => {
                        let _ = tx.send(
                            json!({ "type": "completion_delta", "id": id, "delta": "Thinking" }),
                        );
                        let _ = cancelled.unwrap().await;
                        json!({ "type": "response", "id": id, "ok": true,
                            "data": { "text": "Thinking", "rawContent": "Thinking", "toolCalls": [],
                                      "inference": inference("cancelled", 3, 1) } })
                    }
                    "complete" if has_tools => json!({ "type": "response", "id": id, "ok": true,
                        "data": { "text": "", "rawContent": "<tool_call>…</tool_call>",
                                  "toolCalls": [{ "id": "t1", "name": "get_balance", "arguments": { "asset": "BTC" } }],
                                  "inference": inference("completed", 10, 5) } }),
                    "complete" => {
                        for d in ["Hel", "lo"] {
                            let _ = tx
                                .send(json!({ "type": "completion_delta", "id": id, "delta": d }));
                        }
                        json!({ "type": "response", "id": id, "ok": true,
                            "data": { "text": "Hello", "rawContent": "Hello", "toolCalls": [],
                                      "inference": inference("completed", 3, 2) } })
                    }
                    _ => return,
                };
                let _ = tx.send(reply);
            });
            Ok(())
        }
        fn subscribe(&self) -> broadcast::Receiver<Value> {
            self.tx.subscribe()
        }
    }

    const TOKEN: &str = "test-token-0123456789abcdefghijklmnopqrstu";

    async fn start(sidecar: Arc<FakeSidecar>) -> (String, oneshot::Sender<()>) {
        let (addr, stop) = serve(
            sidecar,
            "127.0.0.1:0".parse().unwrap(),
            Arc::new(RwLock::new(TOKEN.into())),
            false,
        )
        .await
        .unwrap();
        (format!("http://{}", addr), stop)
    }

    fn client() -> reqwest::Client {
        let _ = rustls::crypto::ring::default_provider().install_default();
        reqwest::Client::builder().build().unwrap()
    }

    fn chat_body(stream: bool) -> Value {
        json!({ "model": "x", "stream": stream, "messages": [{ "role": "user", "content": "hi" }] })
    }

    #[test]
    fn loopback_only_unless_lan() {
        let lo: IpAddr = Ipv4Addr::LOCALHOST.into();
        let lan: IpAddr = Ipv4Addr::new(192, 168, 1, 20).into();
        let public: IpAddr = Ipv4Addr::new(8, 8, 8, 8).into();
        let cgnat: IpAddr = Ipv4Addr::new(100, 64, 0, 1).into();
        assert!(peer_allowed(lo, false));
        assert!(peer_allowed(IpAddr::V6(Ipv6Addr::LOCALHOST), false));
        assert!(!peer_allowed(lan, false));
        assert!(peer_allowed(lan, true));
        assert!(peer_allowed(Ipv4Addr::new(10, 1, 2, 3).into(), true));
        assert!(peer_allowed(Ipv4Addr::new(172, 20, 0, 1).into(), true));
        assert!(!peer_allowed(public, true));
        assert!(!peer_allowed(cgnat, true));
        assert!(peer_allowed(
            IpAddr::V6(Ipv4Addr::new(192, 168, 1, 2).to_ipv6_mapped()),
            true
        ));
        assert!(!peer_allowed(
            IpAddr::V6(Ipv4Addr::new(8, 8, 8, 8).to_ipv6_mapped()),
            true
        ));
        assert!(peer_allowed("fd00::1".parse().unwrap(), true));
        assert!(peer_allowed("fe80::1".parse().unwrap(), true));
        assert!(!peer_allowed("2001:db8::1".parse().unwrap(), true));
    }

    #[test]
    fn tokens_are_random_and_long() {
        let a = new_token();
        assert_eq!(a.len(), 43);
        assert_ne!(a, new_token());
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"abcd"));
    }

    #[test]
    fn translates_openai_messages_and_tools() {
        let body = json!({
            "messages": [
                { "role": "developer", "content": "be brief" },
                { "role": "user", "content": [{ "type": "text", "text": "balance?" }] },
                { "role": "assistant", "content": null, "tool_calls": [{ "id": "c1", "type": "function",
                    "function": { "name": "get_balance", "arguments": "{\"asset\":\"BTC\"}" } }] },
                { "role": "tool", "tool_call_id": "c1", "content": "{\"sat\":1000}" }
            ],
            "tools": [{ "type": "function", "function": { "name": "get_balance", "description": "d",
                "parameters": { "type": "object" } } }],
            "tool_choice": { "type": "function", "function": { "name": "get_balance" } },
            "max_tokens": 999999,
            "temperature": 9.0
        });
        let cmd = build_complete_command("rb-1", &body).unwrap();
        assert_eq!(cmd["cmd"], "complete");
        assert_eq!(
            cmd["messages"][0],
            json!({ "role": "system", "content": "be brief" })
        );
        assert_eq!(cmd["messages"][1]["content"], "balance?");
        assert_eq!(
            cmd["messages"][2]["content"],
            "<tool_call>{\"arguments\":{\"asset\":\"BTC\"},\"name\":\"get_balance\"}</tool_call>"
        );
        assert_eq!(
            cmd["messages"][3],
            json!({ "role": "tool", "content": "{\"sat\":1000}" })
        );
        assert_eq!(cmd["tools"][0]["name"], "get_balance");
        assert_eq!(cmd["toolChoice"], "get_balance");
        assert_eq!(cmd["maxTokens"], MAX_OUTPUT_TOKENS);
        assert_eq!(cmd["temperature"], 2.0);
    }

    #[test]
    fn maps_sampling_and_tool_options() {
        let cmd = build_complete_command(
            "rb-2",
            &json!({ "messages": [{ "role": "user", "content": "a" }],
                "max_tokens": 10, "max_completion_tokens": 20, "temperature": 0.2,
                "tools": [{ "type": "function", "function": { "name": "t" } }],
                "tool_choice": "required" }),
        )
        .unwrap();
        assert_eq!(cmd["maxTokens"], 20);
        assert_eq!(cmd["temperature"], 0.2);
        assert_eq!(cmd["tools"], json!([{ "name": "t" }]));
        assert_eq!(cmd["toolChoice"], "required");

        let cmd = build_complete_command(
            "rb-3",
            &json!({ "messages": [{ "role": "user", "content": "a" }], "tools": [], "max_tokens": 0 }),
        )
        .unwrap();
        assert!(cmd.get("tools").is_none());
        assert!(cmd.get("toolChoice").is_none());
        assert!(cmd.get("temperature").is_none());
        assert_eq!(cmd["maxTokens"], 1);

        for choice in [
            json!("required"),
            json!({ "type": "function", "function": { "name": "nope" } }),
        ] {
            assert!(build_complete_command(
                "x",
                &json!({ "messages": [{ "role": "user", "content": "a" }], "tool_choice": choice }),
            )
            .is_err());
        }
        assert!(build_complete_command(
            "x",
            &json!({ "messages": [{ "role": "user", "content": "a" }], "tool_choice": "maybe" }),
        )
        .is_err());
    }

    #[test]
    fn maps_completion_results() {
        let calls = json!({ "text": "", "toolCalls": [
            { "id": "a", "name": "x", "arguments": { "n": 1 } },
            { "name": "y", "arguments": "{\"raw\":true}" },
            { "name": "z" }
        ], "inference": { "status": "completed", "durationMs": 1 } });
        let body = completion_body("chatcmpl-1", "m", 1, &calls);
        let msg = &body["choices"][0]["message"];
        assert_eq!(msg["content"], Value::Null);
        assert_eq!(msg["tool_calls"][0]["id"], "a");
        assert_eq!(msg["tool_calls"][0]["function"]["arguments"], "{\"n\":1}");
        assert_eq!(msg["tool_calls"][1]["id"], "call_1");
        assert_eq!(
            msg["tool_calls"][1]["function"]["arguments"],
            "{\"raw\":true}"
        );
        assert_eq!(msg["tool_calls"][2]["function"]["arguments"], "{}");
        assert_eq!(body["choices"][0]["finish_reason"], "tool_calls");

        let truncated = json!({ "text": "partial", "toolCalls": [],
            "inference": { "status": "truncated", "durationMs": 1, "promptTokens": 4, "completionTokens": 6, "totalTokens": 10 } });
        let body = completion_body("chatcmpl-2", "m", 1, &truncated);
        assert_eq!(body["choices"][0]["message"]["content"], "partial");
        assert!(body["choices"][0]["message"].get("tool_calls").is_none());
        assert_eq!(body["choices"][0]["finish_reason"], "length");
        assert_eq!(
            body["usage"],
            json!({ "prompt_tokens": 4, "completion_tokens": 6, "total_tokens": 10 })
        );

        let plain = json!({ "text": "hi", "toolCalls": [] });
        assert_eq!(
            completion_body("c", "m", 1, &plain)["choices"][0]["finish_reason"],
            "stop"
        );
        assert_eq!(
            sidecar_error("QVAC model not loaded".into()).status,
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(sidecar_error("boom".into()).status, StatusCode::BAD_GATEWAY);
    }

    #[test]
    fn rejects_bad_requests() {
        assert!(build_complete_command("x", &json!({ "messages": [] })).is_err());
        assert!(build_complete_command(
            "x",
            &json!({ "messages": [{ "role": "user",
            "content": [{ "type": "image_url", "image_url": {} }] }] })
        )
        .is_err());
        assert!(build_complete_command(
            "x",
            &json!({ "messages": [{ "role": "user", "content": "a" }],
            "tools": [{ "type": "function", "function": { "name": "rm -rf" } }] })
        )
        .is_err());
        let many: Vec<Value> = (0..=MAX_MESSAGES)
            .map(|_| json!({ "role": "user", "content": "a" }))
            .collect();
        assert!(build_complete_command("x", &json!({ "messages": many })).is_err());
    }

    #[tokio::test]
    async fn requires_bearer_token() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let res = client()
            .get(format!("{}/v1/models", base))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 401);
        let res = client()
            .get(format!("{}/v1/models", base))
            .bearer_auth("wrong")
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 401);
        let res = client()
            .get(format!("{}/v1/models", base))
            .bearer_auth(TOKEN)
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200);
        let body: Value = res.json().await.unwrap();
        assert_eq!(body["data"][0]["id"], "qwen3.5-2b");
    }

    #[tokio::test]
    async fn rejects_browser_origins() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let res = client()
            .get(format!("{}/v1/models", base))
            .bearer_auth(TOKEN)
            .header("Origin", "http://evil.example")
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 403);
    }

    #[tokio::test]
    async fn rate_limits_per_peer() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let mut statuses = vec![];
        for _ in 0..(RATE_BURST as usize + 3) {
            statuses.push(
                client()
                    .get(format!("{}/v1/x", base))
                    .send()
                    .await
                    .unwrap()
                    .status()
                    .as_u16(),
            );
        }
        assert!(statuses.contains(&429));
    }

    #[tokio::test]
    async fn non_streaming_completion() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let res = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&chat_body(false))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200);
        let body: Value = res.json().await.unwrap();
        assert_eq!(body["object"], "chat.completion");
        assert_eq!(body["model"], "qwen3.5-2b");
        assert_eq!(body["choices"][0]["message"]["content"], "Hello");
        assert_eq!(body["choices"][0]["finish_reason"], "stop");
        assert_eq!(body["usage"]["total_tokens"], 5);
    }

    #[tokio::test]
    async fn tool_calls_pass_through_without_execution() {
        let sidecar = FakeSidecar::new(true, true);
        let (base, _stop) = start(Arc::clone(&sidecar)).await;
        let mut req = chat_body(false);
        req["tools"] = json!([{ "type": "function", "function": { "name": "get_balance", "parameters": {} } }]);
        req["tool_choice"] = json!("required");
        let body: Value = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&req)
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(body["choices"][0]["finish_reason"], "tool_calls");
        let call = &body["choices"][0]["message"]["tool_calls"][0];
        assert_eq!(call["function"]["name"], "get_balance");
        assert_eq!(call["function"]["arguments"], "{\"asset\":\"BTC\"}");
        // Only get_status + complete reach the sidecar — never the agentic `chat`.
        assert_eq!(call["id"], "t1");
        assert_eq!(sidecar.cmds(), vec!["get_status", "complete"]);
        let sent = sidecar.sent.lock()[1].clone();
        assert_eq!(
            sent["tools"],
            json!([{ "name": "get_balance", "parameters": {} }])
        );
        assert_eq!(sent["toolChoice"], "required");
    }

    #[tokio::test]
    async fn streaming_completion() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let mut req = chat_body(true);
        req["stream_options"] = json!({ "include_usage": true });
        let text = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&req)
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        let datas: Vec<&str> = text
            .lines()
            .filter_map(|l| l.strip_prefix("data: "))
            .collect();
        assert_eq!(*datas.last().unwrap(), "[DONE]");
        let content: String = datas
            .iter()
            .filter_map(|d| serde_json::from_str::<Value>(d).ok())
            .filter_map(|v| {
                v.pointer("/choices/0/delta/content")
                    .and_then(Value::as_str)
                    .map(String::from)
            })
            .collect();
        assert_eq!(content, "Hello");
        assert!(text.contains("\"finish_reason\":\"stop\""));
        assert!(text.contains("\"total_tokens\":5"));
    }

    #[tokio::test]
    async fn streaming_tool_calls() {
        let (base, _stop) = start(FakeSidecar::new(true, true)).await;
        let mut req = chat_body(true);
        req["tools"] = json!([{ "type": "function", "function": { "name": "get_balance" } }]);
        let text = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&req)
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        let chunks: Vec<Value> = text
            .lines()
            .filter_map(|l| l.strip_prefix("data: "))
            .filter_map(|d| serde_json::from_str(d).ok())
            .collect();
        let call = chunks
            .iter()
            .find_map(|c| c.pointer("/choices/0/delta/tool_calls/0"))
            .unwrap();
        assert_eq!(call["index"], 0);
        assert_eq!(call["function"]["arguments"], "{\"asset\":\"BTC\"}");
        assert!(text.contains("\"finish_reason\":\"tool_calls\""));
        assert!(text.trim_end().ends_with("data: [DONE]"));
    }

    #[tokio::test]
    async fn offline_brain_and_unloaded_model() {
        let (base, _stop) = start(FakeSidecar::new(false, false)).await;
        let res = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&chat_body(false))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 503);
        let body: Value = client()
            .get(format!("{}/v1/models", base))
            .bearer_auth(TOKEN)
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(body["data"], json!([]));

        // Status says on, but the model is gone by the time `complete` runs.
        let (base, _stop) = start(FakeSidecar::new(true, false)).await;
        let res = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&chat_body(false))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 503);
        let body: Value = res.json().await.unwrap();
        assert_eq!(body["error"]["type"], "unavailable");
        assert_eq!(body["error"]["code"], "unavailable");
        assert_eq!(
            body["error"]["message"],
            "no model is running on the desktop"
        );
    }

    async fn wait_for_cancel(sidecar: &FakeSidecar) -> Value {
        for _ in 0..200 {
            if let Some(c) = sidecar
                .sent
                .lock()
                .iter()
                .find(|c| c["cmd"] == "cancel_completion")
            {
                return c.clone();
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("no cancel_completion sent: {:?}", sidecar.cmds());
    }

    #[tokio::test]
    async fn stream_disconnect_cancels_the_completion() {
        let sidecar = FakeSidecar::new(true, true);
        let (base, _stop) = start(Arc::clone(&sidecar)).await;
        let mut req = chat_body(true);
        req["messages"][0]["content"] = json!("slow");
        let mut res = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&req)
            .send()
            .await
            .unwrap();
        let mut seen = String::new();
        while !seen.contains("Thinking") {
            seen.push_str(&String::from_utf8_lossy(
                &res.chunk().await.unwrap().unwrap(),
            ));
        }
        drop(res);
        let cancel = wait_for_cancel(&sidecar).await;
        let complete = sidecar
            .sent
            .lock()
            .iter()
            .find(|c| c["cmd"] == "complete")
            .cloned()
            .unwrap();
        assert_eq!(cancel["target"], complete["id"]);
        assert!(cancel["id"]
            .as_str()
            .unwrap()
            .starts_with(INTERNAL_ID_PREFIX));
        // The permit is released: the next request runs.
        let res = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&chat_body(false))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200);
    }

    #[tokio::test]
    async fn non_stream_disconnect_cancels_the_completion() {
        let sidecar = FakeSidecar::new(true, true);
        let (base, _stop) = start(Arc::clone(&sidecar)).await;
        let mut req = chat_body(false);
        req["messages"][0]["content"] = json!("slow");
        let fut = client()
            .post(format!("{}/v1/chat/completions", base))
            .bearer_auth(TOKEN)
            .json(&req)
            .send();
        assert!(tokio::time::timeout(Duration::from_millis(200), fut)
            .await
            .is_err());
        wait_for_cancel(&sidecar).await;
    }

    #[tokio::test]
    async fn rotating_the_token_takes_effect_immediately() {
        let token = Arc::new(RwLock::new(TOKEN.to_string()));
        let (addr, _stop) = serve(
            FakeSidecar::new(true, true),
            "127.0.0.1:0".parse().unwrap(),
            Arc::clone(&token),
            false,
        )
        .await
        .unwrap();
        *token.write() = "rotated-token-0123456789abcdefghijklmnop".into();
        let url = format!("http://{}/v1/models", addr);
        assert_eq!(
            client()
                .get(&url)
                .bearer_auth(TOKEN)
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
        assert_eq!(
            client()
                .get(&url)
                .bearer_auth("rotated-token-0123456789abcdefghijklmnop")
                .send()
                .await
                .unwrap()
                .status(),
            200
        );
    }

    /// Serves a real sidecar for manual curl checks:
    /// `RB_E2E_CMD="node shim.mjs" RB_E2E_TOKEN=… cargo test e2e -- --ignored --nocapture`.
    #[tokio::test(flavor = "multi_thread")]
    #[ignore]
    async fn e2e_real_sidecar() {
        use std::io::{BufRead, BufReader, Write};
        use std::process::{Command, Stdio};

        struct StdioSidecar {
            stdin: Mutex<std::process::ChildStdin>,
            tx: broadcast::Sender<Value>,
        }
        impl Sidecar for StdioSidecar {
            fn is_running(&self) -> bool {
                true
            }
            fn send(&self, payload: &Value) -> Result<(), String> {
                let mut stdin = self.stdin.lock();
                writeln!(stdin, "{}", payload).map_err(|e| e.to_string())
            }
            fn subscribe(&self) -> broadcast::Receiver<Value> {
                self.tx.subscribe()
            }
        }

        let cmd = std::env::var("RB_E2E_CMD").expect("RB_E2E_CMD");
        let mut parts = cmd.split_whitespace();
        let mut child = Command::new(parts.next().unwrap())
            .args(parts)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let (tx, _) = broadcast::channel(4096);
        let reader_tx = tx.clone();
        let stdout = child.stdout.take().unwrap();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    let _ = reader_tx.send(v);
                }
            }
        });
        let sidecar = Arc::new(StdioSidecar {
            stdin: Mutex::new(child.stdin.take().unwrap()),
            tx,
        });
        let token = std::env::var("RB_E2E_TOKEN").unwrap_or_else(|_| new_token());
        let port: u16 = std::env::var("RB_E2E_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DEFAULT_PORT);
        let (addr, _stop) = serve(
            sidecar,
            SocketAddr::from(([127, 0, 0, 1], port)),
            Arc::new(RwLock::new(token)),
            false,
        )
        .await
        .unwrap();
        eprintln!("remote brain e2e serving on http://{}/v1", addr);
        let hold = std::env::var("RB_E2E_HOLD_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(120);
        tokio::time::sleep(Duration::from_secs(hold)).await;
        let _ = child.kill();
        let _ = child.wait();
    }
}
