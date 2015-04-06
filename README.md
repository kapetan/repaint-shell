# repaint-shell

Simple interface for [repaint][rp] HTML layout engine based on `atom-shell`. Supports rendering HTML, JSON and Markdown.

This is a browser in a browser, and not a particularly good browser, since `repaint` doesn't support the whole CSS specification. If you though `IE6` was bad, wait untill you tried this one.

# Usage

```
git clone git@github.com:kapetan/repaint-shell.git
cd repaint-shell
npm install
npm start
```

The start command accepts a list of URLs to open at startup. E.g.

	npm start http://en.m.wikipedia.org/wiki/Tiro

[rp]: https://github.com/kapetan/repaint
