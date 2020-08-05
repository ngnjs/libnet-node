export default (app, API) => {
  // app.use(API.log)
  // API.applyCommonConfiguration(app)

  let response = { text: 'static' }

  app.get('/static', (req, res) => {
    res.set('cache-control', 'max-age=200')
    res.json(response)
  })

  // A helper endpoint to change responses
  app.get('/change/:value', (req, res) => {
    if (req.params.value) {
      response = { text: req.params.value }
      return res.sendStatus(200)
    }

    res.status(400).send('No value specified.')
  })

  app.get('/reset', (req, res) => {
    response = { text: 'static' }
    res.sendStatus(200)
  })
}
