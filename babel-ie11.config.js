// Special IE11 build.
module.exports = { presets };
const presets = [
    [
        '@babel/preset-env',
        {
            targets: {
                ie: '11'
            },
            useBuiltIns: 'usage',
            corejs: { version: 3, proposals: true }
        },
    ],
];
