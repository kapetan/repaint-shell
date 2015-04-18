var path = require('path');
var util = require('util');
var app = require('app');
var BrowserWindow = require('browser-window');

var window;

app.on('ready', function() {
	window = new BrowserWindow({ width: 800, height: 600, 'min-width': 800, frame: false });
	var argv = JSON.stringify(process.argv.slice(2));
	var url = util.format('file://%s#%s', path.join(__dirname, 'index.html'), argv);

	window.loadUrl(url);
});
