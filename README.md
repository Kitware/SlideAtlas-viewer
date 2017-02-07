# SlideAtlas-viewer

  [![Travis](https://travis-ci.org/SlideAtlas/SlideAtlas-viewer.svg?branch=master)]()

  A multiresolution image viewer, optimized for whole slide images.

## Prerequisites
The development environment requires Node Package Manager to be installed.
See the [Node.js documentation](https://docs.npmjs.com/getting-started/installing-node)
for details on how to install it.

## Building
To fetch dependencies necessary for building, run:

`npm install`

To build the full distributable web code, then run:

`npm run build`

## Testing
To run style checks, run:

`npm test`

To run style checks while editing in code Vim, check out
[this tutorial](`http://usevim.com/2016/03/07/linting/`).

## Releasing
To generate a new release:

* Ensure that the local machine is configured to push to NPM:

  `npm whoami`

  * If this command returns an error, configure the machine with:

    `npm adduser`

    using your credentials [for NPM](https://www.npmjs.com/).

* Ensure that the local repository is on the latest version of the master branch, with
no outstanding changes:

  `git stash && git checkout master && git pull`

* Bump the package version, using either:
  * `npm version minor`, for new features
  * `npm version patch`, for pure bug fixes

  Note, the `npm version` command will automatically install, build, and test the
  package. It will also push the newly-tagged version to GitHub (assuming your GitHub
  remote is called `master`).

* Push the release to NPM:

  `npm publish`
