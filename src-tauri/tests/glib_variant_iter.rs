#![cfg(target_os = "linux")]
use glib::variant::ToVariant;

#[test]
fn variant_string_iterator_handles_all_affected_operations() {
    let value = ["first", "", "π", "last"].to_variant();
    assert_eq!(value.array_iter_str().unwrap().collect::<Vec<_>>(), ["first", "", "π", "last"]);
    assert_eq!(value.array_iter_str().unwrap().rev().collect::<Vec<_>>(), ["last", "π", "", "first"]);
    assert_eq!(value.array_iter_str().unwrap().nth(2), Some("π"));
    assert_eq!(value.array_iter_str().unwrap().nth_back(2), Some(""));
    assert_eq!(value.array_iter_str().unwrap().last(), Some("last"));
    let empty = Vec::<String>::new().to_variant();
    assert_eq!(empty.array_iter_str().unwrap().next(), None);
}
