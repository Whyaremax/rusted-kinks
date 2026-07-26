# Remote browser testing

KD Hybrid can serve the isolated test installation to a web browser. This is
intended for personal testing over a private network or an authenticated
private-network tunnel. It does not modify or expose the normal Electron save
directory.

First prepare or refresh the isolated test installation:

```powershell
npm run test:local:setup
```

For testing on the same computer:

```powershell
npm run test:remote
```

The default URL is `http://127.0.0.1:8787`. The launcher prints a one-time
tokenized URL. Opening it stores the token in an HTTP-only browser cookie and
redirects to a clean URL.

To listen on a chosen port for other machines on the LAN or a private tunnel:

```powershell
npm run test:remote -- --host 0.0.0.0 --port 8787
```

Open one of the printed addresses from the remote device. Windows Firewall may
prompt to allow Node.js on private networks. Do not allow it on public networks.

For access away from home, use a private-network tunnel such as Tailscale,
ZeroTier, or an SSH tunnel. Avoid forwarding this port directly through the
router: the server uses plain HTTP, and serving the test copy on the public
internet could expose copyrighted game assets. A token prevents casual access
but is not a replacement for TLS and a private network.

## Stable token and custom paths

A token changes whenever the server restarts unless one is provided:

```powershell
$env:KD_REMOTE_TOKEN = "replace-with-a-long-random-private-value"
npm run test:remote -- --host 0.0.0.0 --port 8787
```

The token must contain at least 16 characters. It can also be supplied with
`--token`, although an environment variable keeps it out of shell history.

Use `--test-root` to select another isolated installation, or `--app-root` to
serve a specific `resources/app` directory:

```powershell
npm run test:remote -- --port 9000 --test-root "D:\KD-test"
```

Run `npm run test:remote -- --help` for all options.

## Save behavior

Browser access cannot use Electron's isolated `user-data` directory. Saves made
through the remote page remain in the remote browser's origin storage. Treat
them as a separate test profile. The normal game save directory and the
isolated Electron test saves are neither read nor served.

The authenticated health endpoint is:

```text
/_kd-remote/health
```

## Slow-connection asset cache

The first browser visit automatically warms a persistent cache containing the
browser-useful game files. The current KD 5.4.92 test installation contributes
approximately 381 MiB across 963 files. A small overlay reports file and byte
progress while the game remains usable.

Static assets receive private one-year cache rules, immutable response hints,
and version-specific ETags. The server calculates an asset-set version when it
starts. If the isolated installation changes, the browser revalidates the
inventory and downloads changed responses; unchanged responses can return a
small `304 Not Modified` response.

The current plain-HTTP LAN address uses Chrome's normal private disk cache.
Browsers can eventually evict that cache when a device is low on space. When
the same server is reached through a trusted HTTPS private tunnel, it
automatically upgrades to Cache Storage plus a cache-first Service Worker,
which provides stronger persistence and offline reuse.

To manually repeat the cache warm from the browser developer console:

```js
KDRemoteCache.warm(true)
```

The current state and progress are available as `KDRemoteCache.state`.
