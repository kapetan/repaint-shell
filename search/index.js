var events = require('events');
var util = require('util');
var fs = require('fs');
var path = require('path');
var domify = require('domify');
var defaultcss = require('defaultcss');
var once = require('once');
var $ = require('dombo');

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
var svg = fs.readFileSync(path.join(__dirname, 'icons.html'), 'utf-8');
var style = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf-8');

var appendSvg = once(function() {
	document.head.appendChild(domify(svg));
});

var Search = function(options) {
	if(!(this instanceof Search)) return new Search(options);

	events.EventEmitter.call(this);
	this._options = options || {};

	var element = domify(html);
	var $element = $(element);
	this.element = element;

	var self = this;
	var $input = $('input', element);
	var $clear = $('.clear-search', element);
	var input = $input[0];

	$element.on('submit', function(e) {
		e.preventDefault();
		var value = input.value;
		if(!value) return;
		input.blur();
		self.emit('search', value);
	});

	$element.on('click', function() {
		input.focus();
	});

	$input.on('focus', function() {
		$element.addClass('focused');
	});

	$input.on('blur', function() {
		$element.removeClass('focused');
	});

	$input.on('input', function(e) {
		var value = e.target.value;
		if (value) $element.addClass('has-term');
		else $element.removeClass('has-term');
	});

	$clear.on('click', function(e) {
		e.preventDefault();
		input.value = '';
		$element.removeClass('has-term');
	});
};

util.inherits(Search, events.EventEmitter);

Search.prototype.appendTo = function(element) {
	if(typeof element === 'string') element = $(element)[0];
	if(this._options.style !== false) defaultcss('search', style);
	appendSvg();
	element.appendChild(this.element);
	return this;
};

Search.prototype.set = function(value) {
	$(this.element).addClass('has-term');
	$('input', this.element)[0].value = value;
	this.emit('search', value);
};

module.exports = Search;
