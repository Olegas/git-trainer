var GitObject = {};
var objects = {};

function saveRepo(repo) {
   /*
      .git
         objects
            ...
         HEAD
         refs
            heads
               master
               ...
            tags
    */
   var fs = new zip.fs.FS();
   var root = fs.root.addDirectory('git-trainer');
   var dotGit = root.addDirectory('.git');
   var obj = dotGit.addDirectory('objects');
   var refs = dotGit.addDirectory('refs');
   var heads = refs.addDirectory('heads');
   refs.addDirectory('tags');

   var oDirs = {};

   Object.keys(objects).forEach(function(o){
      var prefix2 = o.substr(0, 2), name = o.substr(2);
      var dir = oDirs[prefix2] || (oDirs[prefix2] = obj.addDirectory(prefix2));

      dir.addBlob(name, mkBlob(objects[o]));
   });

   dotGit.addText('HEAD', 'ref: refs/heads/' + repo.getData().HEAD + "\n");

   var branches = repo.getData().branches;
   Object.keys(branches).forEach(function(branch){
      heads.addText(branch, branches[branch] + "\n");
   });

   fs.exportBlob(function(blob){
      location = URL.createObjectURL(blob);
   })

}

function mkBlob(data) {
   var arr = new Uint8Array(data.split('').map(function(c){
      return c.charCodeAt(0);
   }));
   return new Blob([arr], { type: 'application/octet-stream' });
}

function save(id) {
   var o = objects[id];
   location = URL.createObjectURL(mkBlob(o));
   return id.substr(0, 2) + '/' + id.substr(2);
}

/**
 *
 * @param {Object} cfg
 * @param {Array}  cfg.parents
 * @param {String} cfg.comment
 * @param {String} cfg.authorName
 * @param {String} cfg.authorEmail
 * @param {String} cfg.tree
 */
GitObject.createCommit = function(cfg) {

   var data = [
      "tree " + cfg.tree
   ], obj;

   (cfg.parents || []).forEach(function(p){
      data.push("parent " + p);
   });

   var author = cfg.authorName + " <" + cfg.authorEmail + ">" + " " + (+new Date()) + " +0000";
   data.push("author " + author, "committer " + author, '', cfg.comment);

   data = data.join('\n');
   obj = "commit " + data.length + "\0" + data;
   var sha = hex_sha1(obj);
   console.log("COMMIT " + sha + " > " + obj);
   obj = deflate(obj);
   objects[sha] = obj;
   return sha;
};

/**
 * @param {String|Array} data
 */
GitObject.createBlob = function(data) {
   data = (typeof data == 'string' ? data : String.fromCharCode.apply(String, data));
   var obj = "blob " + data.length + "\0" + data;
   var sha = hex_sha1(obj);
   // console.log("BLOB " + sha + " > " + bin2hex(obj));
   obj = deflate(obj);
   objects[sha] = obj;
   return sha;
};

/**
 *
 * @param {Array} tree
 * { mode, name, pointer }
 */
GitObject.createTree = function(tree) {
   var data, obj;
   data = tree.map(function(i){
      return "100644 " + i.name + "\0" + hex2bin(i.pointer);
   }).join('');
   obj = "tree " + data.length + "\0" + data;
   var sha = hex_sha1(obj);
   // console.log("TREE " + sha + " > " + bin2hex(obj));
   objects[sha] = deflate(obj);
   return sha;
};

function hex2bin(hex) {
   var uint, res = [], i = 0, offset = 0;
   while(offset < hex.length) {
      uint = hex.substr(offset, 2);
      res[i++] = parseInt(uint, 16);
      offset += 2;
   }
   return String.fromCharCode.apply(String, res);
}

function bin2hex(bin) {
   var r = '';
   for(var i = 0, l = bin.length; i < l; i++) {
      r += '0x' + bin.charCodeAt(i).toString(16) + ' ';
   }
   return r;
}

function adler32(buf) {
   var s1 = 1;
   var s2 = 0;

   for (var n=0; n < buf.length; n++)
   {
      s1 = (s1 + buf.charCodeAt(n)) % 65521;
      s2 = (s2 + s1) % 65521;
   }
   return (s2 << 16) + s1;
}

function deflate(data) {

   var deflater = new zip.Deflater();

   var crc = adler32(data), bytes = [];
   for(var i = 3; i >= 0; i--) {
      bytes.push((crc & (0xFF << (8 * i))) >> (8 * i));
   }

   data = typeof data == 'string' ? data.split('') : data;
   data = data.map(function(c){
      return c.charCodeAt(0);
   });

   var arr = new Uint8Array(data);
   deflater.append(arr);

   return String.fromCharCode(0x78, 0x9C) + String.fromCharCode.apply(null, deflater.flush()) + String.fromCharCode.apply(null, bytes);
}