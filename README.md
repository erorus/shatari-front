# Project Shatari - Front End

This is the user-facing web site code for [Undermine Exchange](https://undermine.exchange), which provides historical auction pricing data for World of Warcraft.

This is one of three layers to this application stack:
* [Project Shatari - Data](https://github.com/erorus/shatari-data) - Parses static game data into JSON files used by other layers. Run from a development environment.
* [Project Shatari - Back End](https://github.com/erorus/shatari) - Regularly consumes dynamic API data into custom-format data files consumed by the front end. Run on the server.
* [Project Shatari - Front End](https://github.com/erorus/shatari-front) - Presents the web interface to the application which consumes data from other layers to render the output. Serve via HTTPS.

## Static Site Architecture

This site is developed as a "static site," in that incoming requests to the server are not processed via PHP, node.js, or any other scripting language. Nginx is intended to serve all files as they are stored on disk.

The back end repository (linked above) will be running in the background to update files in-place on disk, but otherwise it does not interact with incoming requests in any way.

Compared to a dynamic, server-side scripting setup, this design provides more consistent low-latency performance, and scales well with high traffic.

## Directory Structure

* `/index.html` is the main HTML page with a basic layout.
* `/src` contains the JS and SCSS source.
  * `/src/js/main.js` is the main JS entry point, and loads all other JS files as required.
  * `/src/scss/main.scss` is the main SCSS entry point, and includes all other SCSS files as required.
* `/public` is a collection of static assets copied to `/dist` at build time.
  * `/public/fonts` contains fonts used by the site.
  * `/public/images` contains all the various images used by the site.
  * `/public/power.js` is a local copy of [Wowhead's tooltip script](https://www.wowhead.com/tooltips), slightly modified.
  * `/public/highstock-*.js` is a local copy of [Highcharts Stock](https://www.highcharts.com/blog/products/stock/)
* `/dist` is served by nginx (under the `/` root path) and is wiped and reset with each build.
* `/json` is served by nginx (under the `/json` path) and contains static JSON data provided by the Data repository linked above.
  * `/json/realms` is gitignored, but expected to point at the `/realms` directory in the back end repo location.
* `/data` is served by nginx (under the `/data` path) and is a symlink to the directory where the back end process stores the auction statistical data.
* `/oribos` contains some public migration support pages for when Undermine Exchange was renamed from Oribos Exchange, and moved from another domain.

## Installation

* Run `npm install` to download dependencies.
* Run `npm run dev` in your development environment to load a local server with live changes.
* Run `npm run build` in production to wipe and fill the `/dist` directory with compiled files.

## Thanks

Thanks to [Wowhead](https://www.wowhead.com) for providing tooltips and icons.

Click here to support my WoW projects: [![Become a Patron!](https://everynothing.net/patronButton.png)](https://www.patreon.com/bePatron?u=4445407)

## License

Copyright 2026 Gerard Dombroski

Licensed under the Apache License, Version 2.0 (the "License");
you may not use these files except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
