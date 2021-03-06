import { replaceAll } from './utils';

const compiler = require('vue-template-compiler');
const stripComments = require('strip-comments');

const buildStyles = function(styles) {
	let _styles = '';
	if (styles) {
		styles.forEach(it => {
			if (it.content) {
				_styles += it.content;
			}
		});
	}
	if (_styles !== '') {
		return `<style scoped>${_styles.trim()}</style>`;
	}
	return undefined;
};

const getSingleFileComponentParts = function(code) {
	const parts = compiler.parseComponent(code, { pad: 'line' });
	parts.script.content = stripComments(parts.script.content, { preserveNewLines: true });
	return parts;
};

const injectTemplateAndParseExport = function(parts) {
	const code = parts.script.content;
	let index = -1;
	if (code.indexOf('module.exports') !== -1) {
		const startIndex = code.indexOf('module.exports');
		index = code.indexOf('{', startIndex) + 1;
	} else if (code.indexOf('exports.default') !== -1) {
		const startIndex = code.indexOf('exports.default');
		index = code.indexOf('{', startIndex) + 1;
	} else if (code.indexOf('export ') !== -1) {
		const startIndex = code.indexOf('export ');
		index = code.indexOf('{', startIndex) + 1;
	}
	if (index === -1) {
		throw new Error('Failed to parse single file component: ' + code);
	}
	let right = code.substr(index).trim();
	if (right[right.length - 1] === ';') {
		right = right.slice(0, -1);
	}
	const templateString = replaceAll(`${parts.template.content}`, '`', '\\`');
	return `{\ntemplate: \`${templateString}\`,\n${right}`;
};

const extractImports = function(code) {
	let imports = '';
	const lines = code.split('\n');
	lines.forEach(it => {
		if (it.startsWith('import') || it.indexOf('require(') !== -1) {
			imports += it + '\n';
		}
	});
	return imports + '\n';
};

module.exports.isSingleFileComponent = function isSingleFileComponent(code) {
	try {
		const parts = compiler.parseComponent(code, { pad: 'line' });
		return parts.template !== null;
	} catch (err) {
		return false;
	}
};

module.exports.transformSingleFileComponent = function transformSingleFileComponent(code) {
	const parts = getSingleFileComponentParts(code);
	const templateAdded = injectTemplateAndParseExport(parts);
	return {
		component: `
			${extractImports(parts.script.content)}
			new Vue(${templateAdded});
		`,
		style: buildStyles(parts.styles),
	};
};
