import ts = require("typescript");

function isJsxOpeningLike(node: ts.Node): node is ts.JsxOpeningLikeElement {
    return node.kind === ts.SyntaxKind.JsxOpeningElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement
}

function isDefineMessages(el, tagName) {
    return el.kind === ts.SyntaxKind.VariableDeclaration && el.initializer && el.initializer.expression && el.initializer.expression.text === tagName;
}

function findProps(node) {
    var res = [];
    find(node);
    function find(node) {
        if (!node) {
            return undefined;
        }
        if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {

            node.properties.forEach(p => {
                var props = {};
                var prop = {};
                if (p.initializer.properties) {
                    p.initializer.properties.forEach(ip => {
                        prop[ip.name.text] = ip.initializer.text;
                    });
                    res.push(prop);
                }
            });
        }
        return ts.forEachChild(node, find);
    }

    return res;
}

function findFirstJsxOpeningLikeElementWithName(node, tagName: string, dm?: boolean) {
    var res = [];
    find(node);

    function find(node) {
        if (!node) {
            return undefined;
        }
        if (dm && node.getNamedDeclarations) {
            var nd = node.getNamedDeclarations();
            nd.forEach(element => {
                element.forEach(el => {
                    if (isDefineMessages(el, tagName)) {
                        if (el.initializer.kind === ts.SyntaxKind.CallExpression && el.initializer.arguments.length) {
                            var nodeProps = el.initializer.arguments[0];
                            var props = findProps(nodeProps);
                            res = res.concat(props);
                        }
                    }
                })
            })
        } else {
            // Is this a JsxElement with an identifier name?
            if (isJsxOpeningLike(node) && node.tagName.kind === ts.SyntaxKind.Identifier) {
                // Does the tag name match what we're looking for?
                const childTagName = node.tagName as any;
                if (childTagName.text === tagName) {
                    res.push(node);
                }
            }
        }

        return ts.forEachChild(node, find);
    }

    return res;
}
/**
 * Parse tsx files
 * 
 * @export
 * @param {string} contents
 * @returns {array}
 */
function main(contents: string) {
    var sourceFile = ts.createSourceFile('file.ts', contents, ts.ScriptTarget.ES2015, /*setParentNodes */ false, ts.ScriptKind.TSX);

    var elements = findFirstJsxOpeningLikeElementWithName(sourceFile, 'FormattedMessage');
    var dm = findFirstJsxOpeningLikeElementWithName(sourceFile, 'defineMessages', true);

    const emptyObject = o => JSON.stringify(o) === '{}'
    var res = elements.map(element => {
        var msg = {}
        element.attributes.properties.forEach((attr) => {
            // found nothing
            if (!attr.name || !attr.initializer) return
            msg[attr.name.text] = attr.initializer.text || attr.initializer.expression.text
        });
        return msg;
    }).filter(r => !emptyObject(r))

    return res.concat(dm);
}

export default main
