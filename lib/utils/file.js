var fs = require('fs')
  , path = require('path')
  , logger;

try {
  logger = require('./logger');
}
catch (e) {
  logger = console.log;
}

var fileUtils = new (function () {
  var _copyFile = function(fromPath, toPath, opts) {
        var from = path.normalize(fromPath)
          , to = path.normalize(toPath)
          , options = opts || {}
          , fromStat
          , toStat
          , destExists
          , destDoesNotExistErr
          , content
          , filename
          , dirContents
          , targetDir;

        fromStat = fs.statSync(from);

        try {
          toStat = fs.statSync(to);
          destExists = true;
        }
        catch(e) {
          destDoesNotExistErr = e;
          destExists = false;
        }
        // Destination dir or file exists, copy into (directory)
        // or overwrite (file)
        if (destExists) {

          // If there's a rename-via-copy file/dir name passed, use it.
          // Otherwise use the actual file/dir name
          filename = options.rename || path.basename(from);

          // Copying a directory
          if (fromStat.isDirectory()) {
            dirContents = fs.readdirSync(from);
            targetDir = path.join(to, filename);
            // We don't care if the target dir already exists
            try {
              fs.mkdirSync(targetDir, options.mode || 0755);
            }
            catch(e) {
              if (e.code != 'EEXIST') {
                throw e;
              }
            }
            for (var i = 0, ii = dirContents.length; i < ii; i++) {
              _copyFile(path.join(from, dirContents[i]), targetDir);
            }
          }
          // Copying a file
          else {
            content = fs.readFileSync(from);
            // Copy into dir
            if (toStat.isDirectory()) {
              fs.writeFileSync(path.join(to, filename), content);
            }
            // Overwrite file
            else {
              fs.writeFileSync(to, content);
            }
          }
        }
        // Dest doesn't exist, can't create it
        else {
          throw destDoesNotExistErr;
        }
      }

    , _copyDir = function (from, to, opts) {
        var createDir = opts.createDir;
      }

    , _readDir = function (dirPath) {
        var dir = path.normalize(dirPath)
          , paths = []
          , ret = [dir];
        paths = fs.readdirSync(dir);
        paths.forEach(function (p) {
          var curr = path.join(dir, p);
          var stat = fs.statSync(curr);
          if (stat.isDirectory()) {
            ret = ret.concat(_readDir(curr));
          }
          else {
            ret.push(curr);
          }
        });
        return ret;
      }

    , _rmDir = function (dirPath) {
        var dir = path.normalize(dirPath)
          , paths = [];
        paths = fs.readdirSync(dir);
        paths.forEach(function (p) {
          var curr = path.join(dir, p);
          var stat = fs.statSync(curr);
          if (stat.isDirectory()) {
            _rmDir(curr);
          }
          else {
            fs.unlinkSync(curr);
          }
        });
        fs.rmdirSync(dir);
      };

  this.cpR = function (fromPath, toPath, options) {
    var from = path.normalize(fromPath)
      , to = path.normalize(toPath)
      , toStat
      , doesNotExistErr
      , paths
      , filename
      , opts = options || {};

    if (!opts.silent) {
      logger.log('cp -r ' + fromPath + ' ' + toPath);
    }

    opts = {}; // Reset

    if (from == to) {
      throw new Error('Cannot copy ' + from + ' to itself.');
    }

    // Handle rename-via-copy
    try {
      toStat = fs.statSync(to);
    }
    catch(e) {
      doesNotExistErr = e;

      // Get abs path so it's possible to check parent dir
      if (!this.isAbsolute(to)) {
        to = path.join(process.cwd() , to);
      }

      // Save the file/dir name
      filename = path.basename(to);
      // See if a parent dir exists, so there's a place to put the
      /// renamed file/dir (resets the destination for the copy)
      to = path.dirname(to);
      try {
        toStat = fs.statSync(to);
      }
      catch(e) {}
      if (toStat && toStat.isDirectory()) {
        // Set the rename opt to pass to the copy func, will be used
        // as the new file/dir name
        opts.rename = filename;
      }
      else {
        throw doesNotExistErr;
      }
    }

    _copyFile(from, to, opts);
  };

  this.mkdirP = function (dir, mode) {
    var dirPath = path.normalize(dir)
      , paths = dirPath.split(/\/|\\/)
      , currPath
      , next;

    if (paths[0] == '' || /^[A-Za-z]+:/.test(paths[0])) {
      currPath = paths.shift() || '/';
      currPath = path.join(currPath, paths.shift());
    }
    while ((next = paths.shift())) {
      if (next == '..') {
        currPath = path.join(currPath, next);
        continue;
      }
      currPath = path.join(currPath, next);
      try {
        fs.mkdirSync(currPath, mode || 0755);
      }
      catch(e) {
        if (e.code != 'EEXIST') {
          throw e;
        }
      }
    }
  };

  this.readdirR = function (dir, opts) {
    var options = opts || {}
      , format = options.format || 'array'
      , ret;
    ret = _readDir(dir);
    return format == 'string' ? ret.join('\n') : ret;
  };

  this.rmRf = function (p, options) {
    var stat
      , opts = options || {};
    if (!opts.silent) {
      logger.log('rm -rf ' + p);
    }
    try {
      stat = fs.statSync(p);
      if (stat.isDirectory()) {
        _rmDir(p);
      }
      else {
        fs.unlinkSync(p);
      }
    }
    catch (e) {}
  };

  this.isAbsolute = function (p) {
    var match = /^[A-Za-z]+:\\|^\//.exec(p);
    if (match && match.length) {
      return match[0];
    }
    return false;
  };

  this.absolutize = function (p) {
    if (this.isAbsolute(p)) {
      return p;
    }
    else {
      return path.join(process.cwd(), p);
    }
  };

  this.basedir = function (p) {
    var str = p || ''
      , abs = this.isAbsolute(p);
    if (abs) {
      return abs;
    }
    str = str.replace(/\*/g, '').split('/')[0];
    return str || '.';
  };

})();

module.exports = fileUtils;

