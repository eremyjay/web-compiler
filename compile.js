#!/usr/bin/env node

'use strict';

// https://github.com/jmrocela/munchjs
const muncherLibrary = require('munch');
// https://github.com/mishoo/TerserJS2
const terserLibrary = require('terser');
// https://github.com/coderaiser/minify
const minifierLibrary = require('minify');
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


    if (dataToParse.terser.run) {
        dataToParse.terser.js.forEach(function(js) {
            terser(js, dataToParse.terser.filters, rootPath, dataToParse.obfuscate.logging || "standard");
        })
    }


    if (dataToParse.minify.run) {
        dataToParse.minify.view.forEach(function(html) {
            minify(html, dataToParse.minify.filters, 'html', rootPath, dataToParse.obfuscate.logging || "standard");
        });
        dataToParse.minify.css.forEach(function(css) {
            minify(css, dataToParse.minify.filters, 'css', rootPath, dataToParse.obfuscate.logging || "standard");
        });
        /*
        dataToParse.minify.js.forEach(function(js) {
            minify(js, 'js')
        })
        */
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
            minifierLibrary.html(content, (error, data) => {
                if (error)
                    console.error(content.message);
                else
                    minified = data;
            });
        }
        else if (ext == "css") {
            minifierLibrary.css(content, (error, data) => {
                if (error)
                    console.error(error.message);
                else
                    minified = data;
            });
        }
        /*
        else if (ext == "js") {
            minifierLibrary.js(content, (error, data) => {
                if (error)
                    console.error(error.message);
                else
                    minified = data;
            });
        }
        */

        return minified;
    })

    if (logLevel >= 1)
        console.log('Completed Minify Process for .' + ext)
}




function terser(path, filters, rootPath, logging) {
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
        console.log('Starting Terser Process')

    parseDirForTerser(path, filters, '.js', function(content) {
        var options = {};
        var minified = terserLibrary.minify(content, {
            /*
            {
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
            }
            */
        });

        return minified;
    })

    if (logLevel >= 1)
        console.log('Completed Terser Process')
}



function parseDirForTerser(path, filters, ext, func, logging) {
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
            parseForTerser(file, filters, func);
        });
    }
    else if (fsLibrary.statSync(path).isFile())
        parseForTerser(path, filters, func);
}


function parseForTerser(file, filters, func, logging) {
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
            var result = func(content)

            fsLibrary.writeFileSync(file, result.code);
        }
    }
    else {
        if (logLevel >= 2)
            console.log("Skipping due to filter match");
    }
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

