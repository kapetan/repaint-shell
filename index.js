var util = require('util');
var remote = require('remote');
var ElementType = require('domelementtype');
var key = require('keymaster');
var minimist = require('minimist');
var $ = require('dombo');

var search = require('./search');
var tabs = require('./tabs')();
var web = require('./web');

var mouse;
var draggable = true;

try {
	mouse = require('osx-mouse')();
	draggable = false;
} catch(err) {
	console.log('Failed loading osx-mouse - ' + err.message);
}

var titlebar = require('titlebar')({ draggable: draggable });

if(mouse) {
	var offset = null;

	$(titlebar.element).on('mousedown', function(e) {
		offset = [e.clientX, e.clientY];
	});

	mouse.on('left-drag', function(x, y) {
		if(!offset || x < 0 || y < 0) return;
		x = Math.round(x - offset[0]);
		y = Math.round(y - offset[1]);
		remote.getCurrentWindow().setPosition(x, y);
	});

	mouse.on('left-up', function() {
		offset = null;
	});
}

var text = function(nodes) {
	nodes = Array.isArray(nodes) ? nodes : [nodes];

	return nodes
		.reduce(function(acc, node) {
			if(node.type === ElementType.Text) acc.push(node.data);
			if(node.childNodes) acc.push(text(node.childNodes));
			return acc;
		}, [])
		.join('');
};

titlebar.appendTo('#chrome');
tabs.appendTo('#chrome');

titlebar.on('close', function() {
	remote.getCurrentWindow().close();
});

titlebar.on('minimize', function() {
	remote.getCurrentWindow().minimize();
});

titlebar.on('fullscreen', function() {
	var win = remote.getCurrentWindow();
	var fullscreen = win.isFullScreen();
	win.setFullScreen(!fullscreen);
});

titlebar.on('maximize', function() {
	remote.getCurrentWindow().maximize();
});

tabs.on('active', function(tab) {
	var id = tab.dataset.id;
	var url = tab.dataset.url;

	delete tab.dataset.url;

	$('.search, .web').addClass('hidden');
	$(util.format('.search[data-id=%s], .web[data-id=%s]', id, id)).removeClass('hidden');

	tab.state.web.fillParent();
	if(url) tab.state.search.set(url, false);
});

tabs.on('create', function(tab) {
	var id = tab.dataset.id;
	var s = search();
	var w = web();

	tab.state = {
		search: s,
		web: w
	};

	s.element.dataset.id = id;
	w.element.dataset.id = id;

	$(s.element).on('dblclick', function(e) {
		e.stopPropagation();
	});

	s.on('search', function(url) {
		if(url) w.load(url);
		else w.clear();
	});

	w.on('load', function(page) {
		var title = page.document.title;
		title = title && text(title).trim();
		tabs.update(tab, title, page.url);
	});

	w.on('error', function(err) {
		alert(err.message);
	});

	s.appendTo(titlebar.element);
	w.appendTo('#content');
});

key('command+r, ctrl+r', function() {
	if(argv.reload) return;
	var tab = tabs.active();
	if(tab) tab.state.web.reload();
	return false;
});

key('command+t, ctrl+t', function() {
	tabs.create(null, null, true);
	return false;
});

key('command+w, ctrl+w', function() {
	if(tabs.length() === 1) remote.getCurrentWindow().close();
	else {
		var tab = tabs.active();
		tabs.destroy(tab);
	}

	return false;
});

key('command+l, ctrl+l', function() {
	var tab = tabs.active();
	if(tab) tab.state.search.focus();
	return false;
});

key('ctrl+shift+tab', function() {
	tabs.previous();
	return false;
});

key('ctrl+tab', function() {
	tabs.next();
	return false;
});

var argv = JSON.parse(window.location.hash.replace(/^#/, ''));
argv = minimist(argv, {
	boolean: ['reload'],
	default: { reload: false }
});

var urls = argv._;
if(!urls.length) urls = [null];

urls.forEach(function(url, i) {
	var last = i === urls.length - 1;
	tabs.create(null, url, last);
});
