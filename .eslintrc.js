module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true,
        "meteor": true,
        "mocha": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true,
            "jsx": true
        },
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "mocha"
    ],
    "rules": {
        "indent": [
            "error",
            2
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "mocha/no-exclusive-tests": "error",
        "react/jsx-uses-react": "error",
        "react/jsx-uses-vars": "error",
        "no-console": "warn",
        "no-unused-vars": "warn"
    }
};