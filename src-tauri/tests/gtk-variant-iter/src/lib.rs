#[cfg(test)]
mod tests {
    use glib::prelude::*;

    #[test]
    fn strings_survive_optimized_ffi_out_parameter_writes() {
        let values = ["", "hello", "caffè", "⚡ RGB", "last"];
        let variant = values.to_variant();
        assert_eq!(
            variant.array_iter_str().unwrap().collect::<Vec<_>>(),
            values
        );
        assert_eq!(
            variant.array_iter_str().unwrap().rev().collect::<Vec<_>>(),
            values.into_iter().rev().collect::<Vec<_>>()
        );
    }

    #[test]
    fn mixed_ends_and_skipping_preserve_borrowed_strings() {
        let variant = ["zero", "one", "two", "three", "four"].to_variant();
        let mut iter = variant.array_iter_str().unwrap();
        assert_eq!(iter.next(), Some("zero"));
        assert_eq!(iter.next_back(), Some("four"));
        assert_eq!(iter.nth(1), Some("two"));
        assert_eq!(iter.nth_back(0), Some("three"));
        assert_eq!(iter.next(), None);
        assert_eq!(iter.next_back(), None);
        assert_eq!(variant.array_iter_str().unwrap().last(), Some("four"));
    }

    #[test]
    fn empty_arrays_are_fused() {
        let variant = Vec::<String>::new().to_variant();
        let mut iter = variant.array_iter_str().unwrap();
        assert_eq!(iter.next(), None);
        assert_eq!(iter.next_back(), None);
        assert_eq!(iter.len(), 0);
    }
}
