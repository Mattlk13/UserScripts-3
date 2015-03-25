// ==UserScript==
// @id          Github_JSON_Dependencies_Linker@https://github.com/jerone/UserScripts
// @name        Github JSON Dependencies Linker
// @namespace   https://github.com/jerone/UserScripts
// @description Linkify all dependencies found in an JSON file.
// @author      jerone
// @copyright   2015+, jerone (http://jeroenvanwarmerdam.nl)
// @license     GNU GPLv3
// @homepage    https://github.com/jerone/UserScripts/tree/master/Github_JSON_Dependencies_Linker
// @homepageURL https://github.com/jerone/UserScripts/tree/master/Github_JSON_Dependencies_Linker
// @downloadURL https://github.com/jerone/UserScripts/raw/master/Github_JSON_Dependencies_Linker/Github_JSON_Dependencies_Linker.user.js
// @updateURL   https://github.com/jerone/UserScripts/raw/master/Github_JSON_Dependencies_Linker/Github_JSON_Dependencies_Linker.user.js
// @supportURL  https://github.com/jerone/UserScripts/issues
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VCYMHWQ7ZMBKW
// @version     0.1.0
// @grant       GM_xmlhttpRequest
// @run-at      document-end
// @include     https://github.com/*/package.json
// @include     https://github.com/*/bower.json
// @include     https://github.com/*/project.json
// ==/UserScript==
/* global GM_xmlhttpRequest */

(function() {

	var isNPM = location.pathname.endsWith('/package.json'),
		isBower = location.pathname.endsWith('/bower.json'),
		isNuGet = location.pathname.endsWith('/project.json'),
		blobElm = document.querySelector('.blob-wrapper'),
		blobLineElms = blobElm.querySelectorAll('.blob-code > span'),
		pkg = (function() {
			// JSON parser could fail on JSON with comments;
			try {
				return JSON.parse(blobElm.textContent);
			} catch (ex) {
				function stripJsonComments(str) {
						/*!
							strip-json-comments
							Strip comments from JSON. Lets you use comments in your JSON files!
							https://github.com/sindresorhus/strip-json-comments
							by Sindre Sorhus
							MIT License
						*/
						var currentChar;
						var nextChar;
						var insideString = false;
						var insideComment = false;
						var ret = '';
						for (var i = 0; i < str.length; i++) {
							currentChar = str[i];
							nextChar = str[i + 1];
							if (!insideComment && str[i - 1] !== '\\' && currentChar === '"') {
								insideString = !insideString;
							}
							if (insideString) {
								ret += currentChar;
								continue;
							}
							if (!insideComment && currentChar + nextChar === '//') {
								insideComment = 'single';
								i++;
							} else if (insideComment === 'single' && currentChar + nextChar === '\r\n') {
								insideComment = false;
								i++;
								ret += currentChar;
								ret += nextChar;
								continue;
							} else if (insideComment === 'single' && currentChar === '\n') {
								insideComment = false;
							} else if (!insideComment && currentChar + nextChar === '/*') {
								insideComment = 'multi';
								i++;
								continue;
							} else if (insideComment === 'multi' && currentChar + nextChar === '*/') {
								insideComment = false;
								i++;
								continue;
							}
							if (insideComment) {
								continue;
							}
							ret += currentChar;
						}
						return ret;
					}
					// Strip out comments from the JSON and try again;
				return JSON.parse(stripJsonComments(blobElm.textContent));
			}
		})(),
		dependencyKeys = [
			'dependencies',
			'devDependencies',
			'peerDependencies',
			'bundleDependencies',
			'bundledDependencies',
			'optionalDependencies'
		],
		modules = [];

	// Get an unique list of all modules;
	dependencyKeys.forEach(function(dependencyKey) {
		var dependencies = pkg[dependencyKey] || {};
		Object.keys(dependencies).forEach(function(module) {
			if (modules.indexOf(module) === -1) {
				modules.push(module);
			}
		});
	});

	// Get url depending on json type;
	var getUrl = (function() {
		if (isNPM) {
			return function(module) {
				var url = 'https://www.npmjs.org/package/' + module;
				linkify(module, url);
			};
		} else if (isBower) {
			return function(module) {
				GM_xmlhttpRequest({
					method: 'GET',
					url: 'http://bower.herokuapp.com/packages/' + module,
					onload: function(response) {
						var data = JSON.parse(response.responseText);
						var re = /github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
						var parsedUrl = re.exec(data.url.replace(/\.git$/, ''));
						if (parsedUrl) {
							var user = parsedUrl[1];
							var repo = parsedUrl[2];
							var url = 'https://github.com/' + user + '/' + repo;
							linkify(module, url);
						} else {
							linkify(module, data.url);
						}
					}
				});
			};
		} else if (isNuGet) {
			return function(module) {
				var url = 'https://www.nuget.org/packages/' + module;
				linkify(module, url);
			};
		}
	})();

	// Linkify module;
	function linkify(module, url) {

		// Try to find the module; could be mulitple locations;
		var moduleFilterText = '"' + module + '"';
		var moduleElms = Array.prototype.filter.call(blobLineElms, function(blobLineElm) {
			return blobLineElm.textContent.trim() === moduleFilterText;
		});

		// Modules could exist in multiple dependency lists;
		Array.prototype.forEach.call(moduleElms, function(moduleElm) {

			// Module names are textNodes on Github;
			var moduleElmText = Array.prototype.find.call(moduleElm.childNodes, function(moduleElmChild) {
				return moduleElmChild.nodeType === 3;
			});

			var moduleElmLink = document.createElement('a');
			moduleElmLink.setAttribute('href', url);
			moduleElmLink.appendChild(document.createTextNode(module));

			// Replace textNode, so we keep surrounding elements (like the highlighted quotes);
			moduleElm.replaceChild(moduleElmLink, moduleElmText);
		});
	}

	// Init;
	modules.forEach(function(module) {
		getUrl(module);
	});

})();