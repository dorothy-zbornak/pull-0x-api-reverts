const fs = require('fs');
const path = require('path');

module.exports = (() => {
    const root = path.resolve(__dirname, '../artifacts');
    const dir = fs.readdirSync(root);
    const artifacts = {};
    dir.forEach(file => {
        if (file.endsWith('.json')) {
            const name = path.basename(file, '.json');
            const artifact = JSON.parse(fs.readFileSync(path.resolve(root, file)));
            if (artifact.compilerOutput) {
                artifacts[name] = artifact.compilerOutput.abi;
            } else {
                artifact[name] = artifact;
            }
        }
    });
    return artifacts;
})();
