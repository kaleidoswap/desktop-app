use std::collections::VecDeque;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Cache for storing the most recent logs
static LOG_CACHE: Lazy<Mutex<VecDeque<String>>> = Lazy::new(|| Mutex::new(VecDeque::with_capacity(5000)));

pub fn add_to_cache(message: String) {
    let mut cache = LOG_CACHE.lock().unwrap();
    if cache.len() >= 5000 {
        cache.pop_front();
    }
    cache.push_back(message);
}

pub fn get_logs(page: u32, page_size: u32) -> (Vec<String>, u32) {
    let cache = LOG_CACHE.lock().unwrap();
    let total = cache.len();
    
    let start_idx = ((page - 1) * page_size) as usize;
    let end_idx = (start_idx + page_size as usize).min(total);
    
    let logs: Vec<String> = cache
        .iter()
        .skip(start_idx)
        .take(end_idx - start_idx)
        .cloned()
        .collect();

    (logs, total as u32)
} 