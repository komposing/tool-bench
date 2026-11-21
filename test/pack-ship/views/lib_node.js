// Loads lib.js (the Eval node library, verbatim) for Node tests.
const fs = require('fs'); const path = require('path');
module.exports = new Function(fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8') + '\nreturn { packViews };')();
