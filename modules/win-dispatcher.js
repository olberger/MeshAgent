/*
Copyright 2019 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


function dispatch(options)
{
    if (!options || !options.modules || !options.launch || !options.launch.module || !options.launch.method || !options.launch.args) { throw ('Invalid Parameters'); }

    var ipcInteger
    var ret = { options: options };
    require('events').EventEmitter.call(ret, true).createEvent('connection');

    ret._ipc = require('net').createServer(); ret._ipc.parent = ret;
    ret._ipc2 = require('net').createServer(); ret._ipc2.parent = ret;
    ret._ipc.on('close', function () { });
    ret._ipc2.on('close', function () { });

    while (true)
    {
        ipcInteger = require('tls').generateRandomInteger('1000', '9999');
        ret._ipcPath = '\\\\.\\pipe\\taskRedirection-' + ipcInteger;
        
        try
        {
            ret._ipc.listen({ path: ret._ipcPath, writableAll: true });
            ret._ipc2.listen({ path: ret._ipcPath + 'C', writableAll: true });
            break;
        }
        catch (x)
        {
        }
    }
    var str = Buffer.from("require('win-console').hide();require('win-dispatcher').connect('" + ipcInteger + "');").toString('base64');
    ret._ipc2.once('connection', function onConnect(s)
    {
        this.parent._control = s;
        this.parent._control._parent = this;
        this.close();
        this.parent.invoke = function (method, args)
        {
            var d, h = Buffer.alloc(4);
            d = Buffer.from(JSON.stringify({ command: 'invoke', value: { method: method, args: args } }));
            h.writeUInt32LE(d.length + 4);
            this._control.write(h);
            this._control.write(d);
        };
    });
    ret._ipc.once('connection', function onConnect(s)
    {
        this.parent._client = s;
        this.parent._client._parent = this;
        this.close();
        var d, h = Buffer.alloc(4);
        s.descriptorMetadata = 'win-dispatcher, ' + this.parent.options.launch.module + '.' + this.parent.options.launch.method + '()';

        for (var m in this.parent.options.modules)
        {
            d = Buffer.from(JSON.stringify({ command: 'addModule', value: { name: this.parent.options.modules[m].name, js: this.parent.options.modules[m].script } }));
            h.writeUInt32LE(d.length + 4);
            s.write(h);
            s.write(d);
        }
        d = Buffer.from(JSON.stringify({ command: 'launch', value: { module: this.parent.options.launch.module, method: this.parent.options.launch.method, args: this.parent.options.launch.args } }));
        h.writeUInt32LE(d.length + 4);
        s.write(h);
        s.write(d);
        this.parent.emit('connection', s);
    });

    var parms = '/C SCHTASKS /CREATE /F /TN MeshUserTask /SC ONCE /ST 00:00 ';
    if (options.user)
    {
        // Specified User
        parms += ('/RU ' + options.user + ' ');
    }
    else
    {
        if (require('user-sessions').getProcessOwnerName(process.pid).tsid == 0)
        {
            // LocalSystem
            parms += ('/RU SYSTEM ');
        }
    }
    parms += ('/TR "\\"' + process.execPath + '\\" -b64exec ' + str + '"');

    var child = require('child_process').execFile(process.env['windir'] + '\\system32\\cmd.exe', [parms]);
    child.stderr.on('data', function (c) { });
    child.stdout.on('data', function (c) { });
    child.waitExit();

    var child = require('child_process').execFile(process.env['windir'] + '\\system32\\cmd.exe', ['cmd']);
    child.stderr.on('data', function (c) { });
    child.stdout.on('data', function (c) { });
    child.stdin.write('SCHTASKS /RUN /TN MeshUserTask\r\n');
    child.stdin.write('SCHTASKS /DELETE /F /TN MeshUserTask\r\nexit\r\n');

    child.waitExit();

    return (ret);
}

function connect(ipc)
{
    var ipcPath = '\\\\.\\pipe\\taskRedirection-' + ipc;
    global.ipc2Client = require('net').createConnection({ path: ipcPath + 'C' }, function ()
    {
        this.on('data', function (c)
        {
            var cLen = c.readUInt32LE(0);
            if (cLen > c.length)
            {
                this.unshift(c);
                return;
            }
            var cmd = JSON.parse(c.slice(4, cLen).toString());
            switch (cmd.command)
            {
                case 'invoke':
                    global._proxyStream[cmd.value.method].apply(global._proxyStream, cmd.value.args);
                    break;
            }

            if (cLen < c.length) { this.unshift(c.slice(cLen)); }
        });
    });
    global.ipcClient = require('net').createConnection({ path: ipcPath }, function ()
    {
        this.on('close', function () { process.exit(); });
        this.on('data', function (c)
        {
            var cLen = c.readUInt32LE(0);
            if (cLen > c.length)
            {
                this.unshift(c);
                return;
            }
            var cmd = JSON.parse(c.slice(4, cLen).toString());
            switch (cmd.command)
            {
                case 'addModule':
                    addModule(cmd.value.name, cmd.value.js);
                    break;
                case 'launch':
                    var obj = require(cmd.value.module);
                    global._proxyStream = obj[cmd.value.method].apply(obj, cmd.value.args);
                    global._proxyStream.pipe(this, { end: false });
                    this.pipe(global._proxyStream, { end: false });

                    global._proxyStream.on('end', function () { process.exit(); });
                    this.on('end', function () { process.exit(); });
                    break;
            }

            if (cLen < c.length) { this.unshift(c.slice(cLen)); }
        });
    });
    global.ipcClient.on('error', function () { process.exit(); });
    global.ipc2Client.on('error', function () { process.exit(); });
}

module.exports = { dispatch: dispatch, connect: connect };

