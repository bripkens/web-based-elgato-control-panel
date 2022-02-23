const Handlebars = require('handlebars');
const fetch = require('node-fetch');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const lights = JSON.parse(process.env.LIGHTS);

Handlebars.registerHelper('isState', (actual, expected) => actual === expected);
const template = Handlebars.compile(
  fs.readFileSync(path.join(__dirname, 'index.html'), { encoding: 'utf8' })
);

app.use(express.static(path.join(__dirname, '..', 'static')));
app.use(require('multer')().none());

app.get('/', renderCurrentState);

async function renderCurrentState(_, res) {
  const lights = await getState();
  res.send(template({ lights }));
}

async function getState() {
  return await Promise.all(
    lights.map(async light => {
      try {
        const response = await fetch(
          `http://${light.ip}:${light.port}/elgato/lights`
        );
        const state = await response.json();
        return {
          ...light,
          state: state.lights[0].on === 0 ? 'off' : 'on',
          brightness: state.lights[0].brightness,
          temperature: state.lights[0].temperature,
        };
      } catch (error) {
        return {
          ...light,
          state: 'error',
          error,
        };
      }
    })
  );
}

async function setState(lights) {
  await Promise.all(
    lights
      .filter(l => l.state !== 'error')
      .map(light =>
        fetch(`http://${light.ip}:${light.port}/elgato/lights`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            numberOfLights: 1,
            lights: [
              {
                on: light.state === 'on',
                brightness: light.brightness,
                temperature: light.temperature,
              },
            ],
          }),
        })
      )
  );
}

app.post('/set', async (req, res) => {
  const lights = await getState();
  applyReqBodyToState(req, lights);
  await setState(lights);
  res.redirect('/');
});

function applyReqBodyToState(req, lights) {
  for (const light of lights) {
    const brightness = req.body[`brightness-${light.ip}`];
    if (brightness != null) {
      light.brightness = Math.max(3, Math.min(100, Number(brightness)));
    }

    const temperature = req.body[`temperature-${light.ip}`];
    if (temperature != null) {
      light.temperature = Math.max(143, Math.min(344, Number(temperature)));
    }

    const state = req.body[`state-${light.ip}`];
    if (state != null) {
      light.state = state === 'on' ? 'on' : 'off';
    }
  }
}

app.listen(port, () => {
  console.log(`Web-based Elgato control panel listening on port ${port}`);
});
