const path = require('path')
const express = require('express')
const utils = require('./utils')

const url = 'http://127.0.0.1:8000/test'

process.chdir(path.join(__dirname, ".."))

utils.npm_run("build", false).then(() => {
  return utils.run_command("tsc", [], "test");
}).then(() => {
  return utils.run_command("node", ["tools/prepare"], "test")
}).then(() => {
  const app = express()
  app.use(express.static(process.cwd()))
  app.listen(8000, () => console.log(`[HyperMD] ${url} is now ready`))
  utils.open_url(url)
})
