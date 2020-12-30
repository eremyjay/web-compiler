#!/usr/bin/env node

'use strict';

// https://github.com/jmrocela/munchjs
const muncherLibrary = require('munch');
// https://github.com/mishoo/TerserJS2
const terserLibrary = require('terser');
const minifyCSS = require('clean-css');
const minifyHTML = require('html-minifier');
// https://github.com/javascript-obfuscator/javascript-obfuscator
const obfuscatorLibrary = require('javascript-obfuscator');

const fsLibrary = require('fs');
const fsExtra = require('fs-extra');

const globLibrary = require('glob');
const ncp = require('ncp').ncp;

const pathLibrary = require('path');


var args = process.argv;
var arrayArgs = [];

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
  arrayArgs.push(val);
});

// Start

runCompile();

async function runCompile() {
    var dataToParse = JSON.parse(fsLibrary.readFileSync(args[2], 'utf8'));

    console.log('Root path: ' + dataToParse.rootPath);
    var rootPath = dataToParse.rootPath.replace(/\/$/, '') || "";

    if (dataToParse.remove.run) {
        console.log('Removing files');

        if (arrayArgs.length <= 3) { // No filtering involved
            var targets = dataToParse.remove.files;

            targets.forEach(function(target) {
                removeFiles(target, rootPath, dataToParse.remove.logging || "standard");
            });
        }
    }

    if (dataToParse.create.run) {
        console.log('Creating directories');

        if (arrayArgs.length <= 3) { // No filtering involved
            var targets = dataToParse.create.folders;

            targets.forEach(function (target) {
                createFolders(target, rootPath, dataToParse.create.logging || "standard");
            });
        }
    }

    if (dataToParse.execute.run) {
        console.log('Executing commands');

        dataToParse.execute.commands.forEach(function(command) {
            if (arrayArgs.length >= 4) {
                try {
                    var runCheck = new RegExp(arrayArgs[3]);
                    if (runCheck.exec(command) != null)
                        runCommand(command, rootPath, dataToParse.execute.logging || "standard");
                }
                catch (e) {
                    console.log(e);
                }
            }
            else
                runCommand(command, rootPath, dataToParse.execute.logging || "standard");
        });
    }

    if (dataToParse.copy.run) {
        console.log('Copying files');

        var fileList = dataToParse.copy.files;

        for (var i = 0; i < fileList.length; i++) {
            var files = fileList[i];
            await copyFiles(files.from, files.to, rootPath, dataToParse.copy.logging || "standard");
        }
    }


    if (dataToParse.clean.run) {
        console.log('Cleaning files');

        if (arrayArgs.length <= 3) { // No filtering involved
            var targets = dataToParse.clean.files;

            targets.forEach(function(target) {
                removeFiles(target, rootPath, dataToParse.clean.logging || "standard");
            });
        }
    }

    if (dataToParse.replace.run) {
        console.log('Performing replacements');

        var fileList = dataToParse.replace.files;

        fileList.forEach(function(files) {
            replaceContent(files.path, dataToParse.replace.filters, files.pattern, files.replace, files.modifiers, rootPath, dataToParse.replace.logging || "standard");
        });
    }
    

    if (dataToParse.rename.run) {
        for (var i = 0; i < dataToParse.rename.view.length; i++) {
            var path = dataToParse.rename.view[i];
            dataToParse.rename.view[i] = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');
        }

        for (var i = 0; i < dataToParse.rename.css.length; i++) {
            var path = dataToParse.rename.css[i];
            dataToParse.rename.css[i] = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');
        }

        for (var i = 0; i < dataToParse.rename.js.length; i++) {
            var path = dataToParse.rename.js[i];
            dataToParse.rename.js[i] = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');
        }

        var muncher = new muncherLibrary.Muncher({
            'view' : dataToParse.rename.view.join(','),
            'css' : dataToParse.rename.css.join(','),
            'js' : dataToParse.rename.js.join(','),
            'ignore' : dataToParse.rename.options.ignore,
            'map' : dataToParse.rename.options.map,
            // 'read' : 'mapping_input.txt',
            'suffix' : ''
        })

        muncher.run(dataToParse.obfuscate.logging || "standard");
    }


    if (dataToParse.minify.run) {
        if (dataToParse.minify.view != null) {
            dataToParse.minify.view.forEach(function (html) {
                minify(html, dataToParse.minify.filters, 'html', rootPath, dataToParse.obfuscate.logging || "standard");
            });
        }

        if (dataToParse.minify.css != null) {
            dataToParse.minify.css.forEach(function (css) {
                minify(css, dataToParse.minify.filters, 'css', rootPath, dataToParse.obfuscate.logging || "standard");
            });
        }

        if (dataToParse.minify.js != null) {
            dataToParse.minify.js.forEach(function (js) {
                minify(js, dataToParse.minify.filters, 'js', rootPath, dataToParse.obfuscate.logging || "standard");
            });
        }
    }

    if (dataToParse.obfuscate.run) {
        dataToParse.obfuscate.js.forEach(function(js) {
            obfuscatejs(js, dataToParse.baseUrl, dataToParse.obfuscate.options, dataToParse.obfuscate.filters, rootPath, dataToParse.obfuscate.logging || "standard");
        });
    }
}



// Done


function removeFiles(target, rootPath, logging, mode) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    target = (target.startsWith("/")) ? target : rootPath + "/" + target.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Removing files and folders: ' + target);

    if (fsLibrary.existsSync(target)) {
        switch (mode) {
            case 'native':
               if (fsLibrary.statSync(target).isDirectory()) {
                    var files = globLibrary.sync(target.replace(/\/$/, '') + '/**/*');

                    files.reverse().forEach(function (file) {
                        if (fsLibrary.statSync(file).isDirectory()) {
                            if (logLevel >= 1)
                                console.log("Removing directory: " + file);
                            fsLibrary.rmdirSync(file);
                        }
                        else if (fsLibrary.statSync(file).isFile()) {
                            if (logLevel >= 1)
                                console.log("Removing file: " + file);
                            fsLibrary.unlinkSync(file);
                        }
                    });

                    if (logLevel >= 1)
                        console.log("Removing directory: " + target);
                    fsLibrary.rmdirSync(target);
                }
                else if (fsLibrary.statSync(target).isFile()) {
                    if (logLevel >= 1)
                        console.log("Removing file: " + target);
                    fsLibrary.unlinkSync(target);
                }
                break;
            default:
                fsExtra.removeSync(target);
        }
    }
    else {
        if (logLevel >= 1)
            console.log("File or directory does not exist: " + target);
    }
}


function createFolders(target, rootPath, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    target = (target.startsWith("/")) ? target : rootPath + "/" + target.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Creating folder: ' + target);

    if (!fsLibrary.existsSync(target)) {
        if (logLevel >= 1)
            console.log("Creating directory: " + target);
        fsLibrary.mkdirSync(target);
    }
    else {
        if (logLevel >= 1)
            console.log("File or directory already exists: " + target);
    }
}


function runCommand(command, rootPath, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    command = command.replace(/[$]rootPath/g, rootPath);

    if (logLevel >= 1)
        console.log('Running command: ' + command);
    var execSync = require('child_process').execSync;
    process.stdout.write(execSync(command));
}


async function copyFiles(from, to, rootPath, logging, mode) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    from = (from.startsWith("/")) ? from : rootPath + "/" + from.replace(/^\//, '');
    to = (to.startsWith("/")) ? to : rootPath + "/" + to.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Copying files: ' + from + " to " + to);

    if (fsLibrary.existsSync(from)) {
        switch (mode) {
            case 'native':
                if (fsLibrary.statSync(from).isDirectory()) {
                    var dest = to.replace(/\/?$/, '/');

                    if (!fsLibrary.existsSync(dest)) {
                        if (logLevel >= 1)
                            console.log("Creating destination directory: " + dest);
                        fsLibrary.mkdirSync(dest);
                    }

                    var files = globLibrary.sync(from.replace(/\/$/, '') + '/**/*');

                    files.forEach(function (file) {
                        var filename = file.replace(/^.*[\\\/]/, '');
                        var subPath = file.replace(from, '').replace(filename, '').replace(/\/+/, '/').replace(/\/?$/, '/');
                        var destPath = (dest + subPath).replace(/\/+/, '/');

                        if (fsLibrary.statSync(file).isDirectory()) {
                            if (logLevel >= 1)
                                console.log("Creating directory: " + file + " to " + destPath + filename);
                            if (!fsLibrary.existsSync(destPath + filename)) {
                                fsLibrary.mkdirSync(destPath + filename);
                            }
                        }
                        else if (fsLibrary.statSync(file).isFile()) {
                            if (logLevel >= 1)
                                console.log("Copying file: " + file + " to " + destPath + filename);
                            fsLibrary.copyFileSync(file, destPath + filename);
                        }
                    });
                }
                else if (fsLibrary.statSync(from).isFile()) {
                    if (logLevel >= 1)
                        console.log("Copying file: " + from + " to " + to);
                    fsLibrary.copyFileSync(from, to);
                }
                break;
            default:
                return await new Promise((resolve, reject) => {
                    ncp(from, to, function (err) {
                        if (err) {
                            console.error(err);
                            reject();
                        }
                        else
                            resolve();
                    });
                });
        }
    }
    else {
        if (logLevel >= 1)
            console.log("File or directory does not exist: " + from);
    }
}




function replaceContent(path, filters, pattern, replace, modifiers, rootPath, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    path = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Replacing content in path: ' + path + " find " + pattern + " with modifier " + modifiers + " and replace with " + replace);

    if (fsLibrary.existsSync(path)) {
        if (fsLibrary.statSync(path).isDirectory()) {
            var paths = globLibrary.sync(path.replace(/\/$/, '') + '/**/*');

            paths.forEach(function (file) {
                if (fsLibrary.statSync(file).isFile()) {
                    replaceContentInFile(file, filters, pattern, replace, modifiers, logging);
                }
            });
        }
        else if (fsLibrary.statSync(path).isFile()) {
            replaceContentInFile(path, filters, pattern, replace, modifiers, logging);
        }
    }
    else {
        if (logLevel >= 1)
            console.log("path or directory does not exist: " + path);
    }
}

function replaceContentInFile(file, filters, pattern, replace, modifiers, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    file = (file.startsWith("/")) ? file : rootPath + "/" + file.replace(/^\//, '');

    var filterMatch = false;
    filters.forEach(function (filter) {
        if (new RegExp(filter).test(file))
            filterMatch = true;
    });

    if (!filterMatch) {
        if (modifiers == null)
            modifiers = "";

        var regex = new RegExp(pattern, modifiers);

        var beforeContent = fsLibrary.readFileSync(file, 'utf8');

        if (regex.test(beforeContent)) {
            var afterContent = beforeContent.replace(regex, replace);

            if (logLevel >= 1)
                console.log("Replacing content for file: " + file + " find " + pattern + " with modifier " + modifiers + " and replace with " + replace);
            fsLibrary.writeFileSync(file, afterContent);
        }
    }
    else {
        if (logLevel >= 1)
            console.log("Skipping due to filter match");
    }
}



function obfuscatejs(path, baseUrl, options, filters, rootPath, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    path = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Starting Obfuscate Process: ' + path);

    parseDirForObfuscator(path, filters, '.js', function(content, path) {
        var name = pathLibrary.basename(path);
        options.sourceMapBaseUrl = baseUrl + '/map/' + name;
        options.sourceMapFileName = 'map';

        var obfuscateResult = obfuscatorLibrary.obfuscate(content, options);

        var code = obfuscateResult.getObfuscatedCode();
        var sourceMap = null;

        if (options.sourceMap)
            sourceMap = obfuscateResult.getSourceMap();
        else
            sourceMap = null;

        return {
            code: code,
            map: sourceMap
        };
    })

    if (logLevel >= 1)
        console.log('Completed Obfuscate Process')
}



function minify(path, filters, ext, rootPath, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    path = (path.startsWith("/")) ? path : rootPath + "/" + path.replace(/^\//, '');

    if (logLevel >= 1)
        console.log('Starting Minify Process for .' + ext)

    parseDirForMinify(path, filters, ext, function(content, method) {
        var minified = ""

        if (ext == "html") {
            minified = minifyHTML.minify(content, {
                caseSensitive: false,
                collapseBooleanAttributes: false,
                collapseInlineTagWhitespace: false,
                collapseWhitespace: false,
                conservativeCollapse: false,
                continueOnParseError: false,
                customAttrAssign: [ ],
                // customAttrCollapse,
                customAttrSurround: [ ],
                customEventAttributes: [ /^on[a-z]{3,}$/ ],
                decodeEntities: false,
                html5: true,
                ignoreCustomComments: [ /^!/ ],
                ignoreCustomFragments: [ /<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/ ],
                includeAutoGeneratedTags: true,
                keepClosingSlash: true,
                // maxLineLength,
                minifyCSS: false,
                minifyJS: false,
                minifyURLs: false,
                preserveLineBreaks: false,
                preventAttributesEscaping: false,
                processConditionalComments: false,
                processScripts: [ ],
                quoteCharacter: '"',
                removeAttributeQuotes: false,
                removeComments: true,
                removeEmptyAttributes: false,
                removeEmptyElements: false,
                removeOptionalTags: false,
                removeRedundantAttributes: false,
                removeScriptTypeAttributes: false,
                removeStyleLinkTypeAttributes: false,
                removeTagWhitespace: false,
                sortAttributes: false,
                sortClassName: false,
                trimCustomFragments: false,
                useShortDoctype: false
            });
        }
        else if (ext == "css") {
            var cssMinifier = new minifyCSS({
                compatibility: {
                    colors: {
                        opacity: true // controls `rgba()` / `hsla()` color support
                    },
                    properties: {
                        backgroundClipMerging: true, // controls background-clip merging into shorthand
                        backgroundOriginMerging: true, // controls background-origin merging into shorthand
                        backgroundSizeMerging: true, // controls background-size merging into shorthand
                        colors: true, // controls color optimizations
                        ieBangHack: false, // controls keeping IE bang hack
                        ieFilters: false, // controls keeping IE `filter` / `-ms-filter`
                        iePrefixHack: false, // controls keeping IE prefix hack
                        ieSuffixHack: false, // controls keeping IE suffix hack
                        merging: true, // controls property merging based on understandability
                        shorterLengthUnits: false, // controls shortening pixel units into `pc`, `pt`, or `in` units
                        spaceAfterClosingBrace: true, // controls keeping space after closing brace - `url() no-repeat` into `url()no-repeat`
                        urlQuotes: false, // controls keeping quoting inside `url()`
                        zeroUnits: true // controls removal of units `0` value
                    },
                    selectors: {
                        adjacentSpace: false, // controls extra space before `nav` element
                        ie7Hack: true, // controls removal of IE7 selector hacks, e.g. `*+html...`
                        // mergeablePseudoClasses: [':active', ...], // controls a whitelist of mergeable pseudo classes
                        // mergeablePseudoElements: ['::after', ...], // controls a whitelist of mergeable pseudo elements
                        mergeLimit: 8191, // controls maximum number of selectors in a single rule (since 4.1.0)
                        multiplePseudoMerging: true // controls merging of rules with multiple pseudo classes / elements (since 4.1.0)
                    },
                    units: {
                        ch: true, // controls treating `ch` as a supported unit
                        in: true, // controls treating `in` as a supported unit
                        pc: true, // controls treating `pc` as a supported unit
                        pt: true, // controls treating `pt` as a supported unit
                        rem: true, // controls treating `rem` as a supported unit
                        vh: true, // controls treating `vh` as a supported unit
                        vm: true, // controls treating `vm` as a supported unit
                        vmax: true, // controls treating `vmax` as a supported unit
                        vmin: true // controls treating `vmin` as a supported unit
                    }
                }
            });

            var output = cssMinifier.minify(content);

            /*
            console.log(output.styles); // optimized output CSS as a string
            console.log(output.sourceMap); // output source map if requested with `sourceMap` option
            console.log(output.errors); // a list of errors raised
            console.log(output.warnings); // a list of warnings raised
            console.log(output.stats.originalSize); // original content size after import inlining
            console.log(output.stats.minifiedSize); // optimized content size
            console.log(output.stats.timeSpent); // time spent on optimizations in milliseconds
            console.log(output.stats.efficiency); // `(originalSize - minifiedSize) / originalSize`, e.g. 0.25 if size is reduced from 100 bytes to 75 bytes
            */

            minified = output.styles;
        }
        else if (ext == "js") {
            minified = terserLibrary.minify(content, {
                parse: {
                    // parse options
                },
                compress: {
                    // compress options
                },
                mangle: {
                    // mangle options

                    properties: {
                        // mangle property options
                    }
                },
                output: {
                    // output options
                },
                sourceMap: {
                    // source map options
                },
                ecma: 5, // specify one of: 5, 6, 7 or 8
                keep_classnames: false,
                keep_fnames: false,
                ie8: false,
                module: false,
                nameCache: null, // or specify a name cache object
                safari10: false,
                toplevel: false,
                warnings: false,
            });
        }

        return minified;
    })

    if (logLevel >= 1)
        console.log('Completed Minify Process for .' + ext)
}


function parseDirForMinify(path, filters, ext, func, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    var extension = "." + ext || '.js'

    if (logLevel >= 1)
        console.log('Reviewing structure for parsing on: ' + path)

    if (fsLibrary.statSync(path).isDirectory()) {
        var files = globLibrary.sync(path.replace(/\/$/, '') + '/**/*' + extension);

        files.forEach(function(file) {
            parseForMinify(file, filters, ext, func);
        });
    }
    else if (fsLibrary.statSync(path).isFile())
        parseForMinify(path, filters, ext, func);
}


function parseForMinify(file, filters, ext, func, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    if (logLevel >= 2)
        console.log('Parsing process on: ' + file)

    var filterMatch = false;
    filters.forEach(function (filter) {
        if (new RegExp(filter).test(file))
            filterMatch = true;
    });

    if (!filterMatch) {
        if (fsLibrary.existsSync(file)) {
            var content = fsLibrary.readFileSync(file, 'utf8').toString();

            if (logLevel >= 2)
                console.log('Executing function')
            var result = func(content, ext)

            fsLibrary.writeFileSync(file, result)
        }
    }
    else {
        if (logLevel >= 2)
            console.log("Skipping due to filter match");
    }
}


function parseDirForObfuscator(path, filters, ext, func, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    var extension = ext || '.js'

    if (logLevel >= 1)
        console.log('Reviewing structure for parsing on: ' + path)

    if (fsLibrary.statSync(path).isDirectory()) {
        var files = globLibrary.sync(path.replace(/\/$/, '') + '/**/*' + extension);

        files.forEach(function(file) {
            parseForObfuscator(file, filters, func);
        });
    }
    else if (fsLibrary.statSync(path).isFile())
        parseForObfuscator(path, filters, func);
}


function parseForObfuscator(file, filters, func, logging) {
    var logLevel = 1;
    switch (logging) {
        case 'silent':
            logLevel = 0;
            break;
        case 'verbose':
            logLevel = 2;
            break;
        case 'standard':
        default:
            logLevel = 1;
    }

    if (logLevel >= 2)
        console.log('Parsing process on: ' + file)

    var filterMatch = false;
    filters.forEach(function (filter) {
        if (new RegExp(filter).test(file))
            filterMatch = true;
    });

    if (!filterMatch) {
        if (fsLibrary.existsSync(file)) {
            var content = fsLibrary.readFileSync(file, 'utf8').toString();

            if (logLevel >= 2)
                console.log('Executing function');
            var result = func(content, file);

            fsLibrary.writeFileSync(file, result.code);

            if (result.map != null) {
                var dir = pathLibrary.dirname(file);
                var name = pathLibrary.basename(file)

                if (!fsLibrary.existsSync(dir + '/map/'))
                    fsLibrary.mkdirSync(dir + '/map/');

                if (!fsLibrary.existsSync(dir + '/map/' + name))
                    fsLibrary.mkdirSync(dir + '/map/' + name);

                if (logLevel >= 2)
                    console.log('Writing source map: ' + dir + '/map/' + name + '/map.js.map');
                fsLibrary.writeFileSync(dir + '/map/' + name + '/map.js.map', result.map);
            }
        }
    }
    else {
        if (logLevel >= 2)
            console.log("Skipping due to filter match");
    }
}

