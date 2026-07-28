//! Minimal KD Hybrid ABI-1 plugin.
//!
//! The host owns the imported linear memory. This example reverses each input
//! payload so the compatibility suite can prove that bytes crossed the ABI.

#[cfg(feature = "diagnostic-import")]
#[link(wasm_import_module = "kd_host")]
unsafe extern "C" {
    fn emit_diagnostic(pointer: u32, length: u32);
}

#[unsafe(no_mangle)]
pub extern "C" fn kd_plugin_abi() -> u32 {
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn kd_plugin_alloc(length: u32) -> u32 {
    let mut bytes = Vec::<u8>::with_capacity(length as usize);
    let pointer = bytes.as_mut_ptr();
    std::mem::forget(bytes);
    pointer as u32
}

/// # Safety
///
/// `pointer` and `length` must describe a live allocation returned by
/// `kd_plugin_alloc` or by `kd_plugin_invoke`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kd_plugin_dealloc(pointer: u32, length: u32) {
    if length == 0 {
        return;
    }
    // SAFETY: The ABI contract gives ownership of this exact allocation back.
    unsafe {
        drop(Vec::from_raw_parts(
            pointer as *mut u8,
            length as usize,
            length as usize,
        ));
    }
}

/// Returns `(output_pointer << 32) | output_length`.
///
/// # Safety
///
/// The host must provide a readable initialized slice in imported linear
/// memory. The returned allocation is separate and becomes host-owned.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kd_plugin_invoke(pointer: u32, length: u32) -> u64 {
    // SAFETY: The host validated and initialized its input allocation.
    let input = unsafe { std::slice::from_raw_parts(pointer as *const u8, length as usize) };
    #[cfg(feature = "diagnostic-import")]
    // SAFETY: The host callback reads the same validated input range.
    unsafe {
        emit_diagnostic(pointer, length);
    }
    let mut output = input.to_vec();
    output.reverse();
    let output_pointer = output.as_mut_ptr() as u32;
    let output_length = output.len() as u32;
    std::mem::forget(output);
    (u64::from(output_pointer) << 32) | u64::from(output_length)
}

#[unsafe(no_mangle)]
pub extern "C" fn kd_plugin_dispose() {}
