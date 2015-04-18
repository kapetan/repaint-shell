var util = require('util');
var remote = require('remote');
var ElementType = require('domelementtype');
var titlebar = require('titlebar')();
var $ = require('dombo');

var search = require('./search');
var tabs = require('./tabs')();
var web = require('./web');

var urls = JSON.parse(window.location.hash.replace(/^#/, ''));

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
	if(url) tab.state.search.set(url);
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

if(!urls.length) urls = [null];

urls.forEach(function(url, i) {
	var last = i === urls.length - 1;
	tabs.create(null, url, last);
});
