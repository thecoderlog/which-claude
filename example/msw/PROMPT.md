A user reported this bug:

> **`resetHandlers()` doesn't restart the generator**
>
> I use a generator function as a response resolver, so each request gets the next response:
>
> ```js
> const server = setupServer(
>   http.get('https://api.example.com/status', function* () {
>     yield HttpResponse.json({ status: 'pending' })
>     yield HttpResponse.json({ status: 'pending' })
>     return HttpResponse.json({ status: 'done' })
>   }),
> )
> ```
>
> I call `server.resetHandlers()` in `afterEach`. In the next test the handler doesn't start over: it carries on from where the generator stopped in the previous test, so my first request already gets `{ status: 'done' }`.

Fix it.
