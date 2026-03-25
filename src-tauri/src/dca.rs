use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const POLL_INTERVAL_SECS: u64 = 30;
const COINGECKO_URL: &str =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcaOrderInfo {
    pub id: String,
    pub order_type: String, // "scheduled" | "price-target"
    pub status: String,     // "active" | "paused" | "completed" | "cancelled"
    pub amount_usdt: f64,
    // Scheduled
    pub interval_secs: Option<u64>,
    pub last_executed_at: Option<u64>,
    // Price-target
    pub trigger_price_usd: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
struct DcaTriggerPayload {
    order_id: String,
    current_price: f64,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoResponse {
    bitcoin: Option<CoinGeckoPrice>,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoPrice {
    usd: Option<f64>,
}

pub struct DcaScheduler {
    orders: Arc<RwLock<Vec<DcaOrderInfo>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    running: Arc<Mutex<bool>>,
}

impl DcaScheduler {
    pub fn new() -> Self {
        DcaScheduler {
            orders: Arc::new(RwLock::new(Vec::new())),
            running: Arc::new(Mutex::new(false)),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(handle);
    }

    pub fn set_orders(&self, orders: Vec<DcaOrderInfo>) {
        println!("[DCA] set_orders: {} orders", orders.len());
        for o in &orders {
            println!(
                "[DCA]   order id={} type={} status={} interval={:?} last_exec={:?} trigger_price={:?}",
                o.id, o.order_type, o.status, o.interval_secs, o.last_executed_at, o.trigger_price_usd
            );
        }
        *self.orders.write().unwrap() = orders;
    }

    pub fn update_last_executed(&self, order_id: &str, timestamp: u64) {
        let mut orders = self.orders.write().unwrap();
        if let Some(order) = orders.iter_mut().find(|o| o.id == order_id) {
            order.last_executed_at = Some(timestamp);
            println!(
                "[DCA] updated last_executed_at for order {} to {}",
                order_id, timestamp
            );
        }
    }

    pub fn start(&self) {
        {
            let mut running = self.running.lock().unwrap();
            if *running {
                println!("[DCA] scheduler already running, skipping start");
                return;
            }
            *running = true;
        }

        println!(
            "[DCA] scheduler starting (poll every {}s)",
            POLL_INTERVAL_SECS
        );

        let orders = Arc::clone(&self.orders);
        let app_handle = Arc::clone(&self.app_handle);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let http = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::blocking::Client::new());

            loop {
                {
                    let is_running = running.lock().unwrap();
                    if !*is_running {
                        println!("[DCA] scheduler stopping");
                        break;
                    }
                }

                // Fetch price (optional - scheduled orders don't need it)
                let current_price = fetch_btc_price(&http);
                println!("[DCA] poll tick — price={:?}", current_price);

                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let triggers: Vec<DcaTriggerPayload> = {
                    let orders_guard = orders.read().unwrap();
                    println!(
                        "[DCA] checking {} active orders at t={}",
                        orders_guard.len(),
                        now
                    );
                    orders_guard
                        .iter()
                        .filter(|o| o.status == "active")
                        .filter_map(|o| check_trigger(o, current_price.unwrap_or(0.0), now))
                        .collect()
                };

                println!("[DCA] {} trigger(s) to emit", triggers.len());
                if !triggers.is_empty() {
                    let handle_guard = app_handle.lock().unwrap();
                    match handle_guard.as_ref() {
                        Some(handle) => {
                            for trigger in triggers {
                                println!(
                                    "[DCA] emitting dca:trigger for order={} price={}",
                                    trigger.order_id, trigger.current_price
                                );
                                if let Err(e) = handle.emit("dca:trigger", &trigger) {
                                    println!("[DCA] emit error: {:?}", e);
                                }
                            }
                        }
                        None => {
                            println!("[DCA] no app_handle set, cannot emit events");
                        }
                    }
                }

                thread::sleep(Duration::from_secs(POLL_INTERVAL_SECS));
            }
        });
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}

fn fetch_btc_price(http: &reqwest::blocking::Client) -> Option<f64> {
    match http.get(COINGECKO_URL).send() {
        Ok(resp) => match resp.json::<CoinGeckoResponse>() {
            Ok(data) => match data.bitcoin.and_then(|b| b.usd) {
                Some(price) => {
                    println!("[DCA] BTC price fetched: ${}", price);
                    Some(price)
                }
                None => {
                    println!("[DCA] price response missing bitcoin/usd field (rate-limited?)");
                    None
                }
            },
            Err(e) => {
                println!("[DCA] price JSON parse error: {:?}", e);
                None
            }
        },
        Err(e) => {
            println!("[DCA] price fetch HTTP error: {:?}", e);
            None
        }
    }
}

fn check_trigger(order: &DcaOrderInfo, current_price: f64, now: u64) -> Option<DcaTriggerPayload> {
    match order.order_type.as_str() {
        "scheduled" => {
            let interval = order.interval_secs?;
            let last = order.last_executed_at.unwrap_or(0);
            let next = last + interval;
            println!(
                "[DCA] scheduled order={} interval={}s last={} next={} now={} → {}",
                order.id,
                interval,
                last,
                next,
                now,
                if now >= next { "TRIGGER" } else { "wait" }
            );
            if now >= next {
                Some(DcaTriggerPayload {
                    current_price,
                    order_id: order.id.clone(),
                })
            } else {
                None
            }
        }
        "price-target" => {
            let trigger_price = order.trigger_price_usd?;
            println!(
                "[DCA] price-target order={} trigger=${} current=${} → {}",
                order.id,
                trigger_price,
                current_price,
                if current_price <= trigger_price && current_price > 0.0 {
                    "TRIGGER"
                } else {
                    "wait"
                }
            );
            if current_price > 0.0 && current_price <= trigger_price {
                Some(DcaTriggerPayload {
                    current_price,
                    order_id: order.id.clone(),
                })
            } else {
                None
            }
        }
        _ => None,
    }
}
