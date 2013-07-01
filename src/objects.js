(function () {

   "use strict";

   var global = (function(){return this || (1,eval)('this')})();

   var GitObject = {};
   var objects = {};

   /**
    *
    * @param {Object} cfg
    * @param {Array}  cfg.parents
    * @param {String} cfg.comment
    * @param {String} cfg.authorName
    * @param {String} cfg.authorEmail
    * @param {String} cfg.tree
    */
   GitObject.createCommit = function (cfg) {

      var now = new Date(),
          offset = now.getTimezoneOffset(),
          data, obj, author, sha, ts;

      data = [
         "tree " + cfg.tree
      ];

      (cfg.parents || []).forEach(function (p) {
         data.push("parent " + p);
      });

      ts = (+now/1000).toFixed(0) + ' ' +
           (offset < 0 ? ((offset = -offset) && '+') : '-') +
           pad((offset/60).toFixed(0)) + pad((offset%60).toFixed(0));

      author = cfg.authorName + " <" + cfg.authorEmail + ">" + " " + ts;
      data.push("author " + author, "committer " + author, '', cfg.comment);

      data = data.join('\n');
      obj = "commit " + data.length + "\0" + data;
      sha = hex_sha1(obj);
      //console.log("COMMIT " + sha + " > " + obj);
      objects[sha] = deflate(obj);
      return sha;
   };

   /**
    * @param {String|Array} data
    */
   GitObject.createBlob = function (data) {
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
   GitObject.createTree = function (tree) {
      var data, obj;
      data = tree.map(function (i) {
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
      while (offset < hex.length) {
         uint = hex.substr(offset, 2);
         res[i++] = parseInt(uint, 16);
         offset += 2;
      }
      return String.fromCharCode.apply(String, res);
   }

   function bin2hex(bin) {
      var r = '';
      for (var i = 0, l = bin.length; i < l; i++) {
         r += '0x' + bin.charCodeAt(i).toString(16) + ' ';
      }
      return r;
   }

   /**
    * Adler32 CRC algorithm.
    * For Zlib-like deflate compression
    * Zlib adds 4-byte Adler32 checksum of original deflated data at the end of a stream
    *
    * @param buf
    * @returns {number}
    */
   function adler32(buf) {
      var s1 = 1;
      var s2 = 0;

      for (var n = 0; n < buf.length; n++) {
         s1 = (s1 + buf.charCodeAt(n)) % 65521;
         s2 = (s2 + s1) % 65521;
      }
      return (s2 << 16) + s1;
   }

   /**
    * Zlib-like deflate.
    * 2-byte header, deflated data, footer (Adler32 cehcksum)
    * @see http://tools.ietf.org/html/rfc1950#section-2.2
    *
    * @param data
    * @returns {string}
    */
   function deflate(data) {

      var deflater = new zip.Deflater();

      var crc = adler32(data), bytes = [];
      for (var i = 3; i >= 0; i--) {
         bytes.push((crc & (0xFF << (8 * i))) >> (8 * i));
      }

      data = typeof data == 'string' ? data.split('') : data;
      data = data.map(function (c) {
         return c.charCodeAt(0);
      });

      var arr = new Uint8Array(data);
      deflater.append(arr);

      return String.fromCharCode(0x78, 0x9C) + String.fromCharCode.apply(null, deflater.flush()) + String.fromCharCode.apply(null, bytes);
   }

   function pad(n) {
      n = "" + n;
      if(n.length < 2)
         return "0" + n;
      else
         return n;
   }

   GitObject.getAll = function() {
      return objects
   };

   global.GitObject = GitObject;

})();