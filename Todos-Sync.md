# TODOs Sync

- [ ] React binding: make sync engine not lazy
- [ ] Add logging for errors in core and core-server (maybe also hono and bun adapter?)
- [x] Implement exponential schedule with maximum
- [ ] On transport error, also log body? Or log on the server!
- [x] In React Native, remove "Default" from new EventSource.Default()
- [ ] Implement proper OTEL
- [x] Use offset from storage
- [ ] Store events offset
- [x] Prevent duplicate events from being inserted (check for ID presence in local event log)
