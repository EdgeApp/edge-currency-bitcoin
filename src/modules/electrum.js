const MAX_CONNECTIONS = 4
const MAX_REQUEST_TIME = 5000
const MAX_CONNECTION_HANG_TIME = 7500

// Replacing net module for ReactNative
var net = process.env.ENV === 'NODEJS' ? require('net') : require('react-native-tcp')

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomHash() {
    return "a" + Math.random().toString(36).substring(7)
}

class Electrum {

    constructor(serverList, incommingCallback) {
        var serverIndex = []
        var j

        this.globalRecievedData = []

        //Compiling serverList
        while (serverIndex.length < MAX_CONNECTIONS && serverIndex.length < serverList.length) {
            j = getRandomInt(0, serverList.length - 1)
            if (serverIndex.indexOf(j) == -1) {
                serverIndex.push(serverList[j])
                this.globalRecievedData.push("")
            }
        }

        this.connections = []
        this.requests = {}
        this.cache = {}
        this.serverList = serverIndex
        this.incommingCallback = incommingCallback

        this.connect()

    }

    compileDataCallback(index) {
        var this$1 = this

        return function(data) {
            var string = ""
            for (var ui = 0; ui <= data.length - 1; ui++) {
                string += String.fromCharCode(data[ui])
            }
            this$1.globalRecievedData[index] += string
            var result = []
            if (this$1.globalRecievedData[index].indexOf("\n") > -1) {
                // // console.log("stringbeforesplit ",this$1.globalRecievedData[index])
                var mdata = this$1.globalRecievedData[index].split("\n")
                for (var k = 0; k <= mdata.length - 1; k++) {
                    if (mdata[k].length < 3) {
                        continue
                    }
                    // // console.log("ssbefore parsing, mk ",mdata[k])
                    var res = false
                    try {
                        res = JSON.parse(mdata[k])
                        result.push(res)
                    } catch (e) {}
                }
            } else {
                // // console.log("ssbefore parsing, s ",this$1.globalRecievedData[index])
                try {
                    data = JSON.parse(this$1.globalRecievedData[index])
                    result.push(data)
                } catch (e) {
                    // console.log("parse error", e)
                }
            }
            if (result.length > 0) {
                this$1.globalRecievedData[index] = ""
            }
            for (var o = 0; o <= result.length - 1; o++) {
                this$1.handleData(result[o])
            }
        }

    }

    updateCache(data) {
        this.cache = {}
        for (var i in data) {
            for (var j in data[i].txs) {
                this.cache[j] = data[i].txs[j]
            }
        }
    }

    collectGarbage() {
        var now = Date.now()
        var callback, randomIndex

        // console.log("collectGarbage > ")

        for (var j in this.connections) {
            // // console.log("RECONNECT CHECK", j, this.connections[j].lastResponse, this.connections[j].lastRequest)
            if (this.connections[j].lastRequest - this.connections[j].lastResponse > MAX_CONNECTION_HANG_TIME) {
                callback = this.compileDataCallback(j)
                    // console.log("RECONNECTING TO SERVER", this.serverList[j][1], this.serverList[j][0], j)
                return this.netConnect(this.serverList[j][1], this.serverList[j][0], callback, j)
            }
        }

        for (var i in this.requests) {
            if (now - this.requests[i].requestTime > MAX_REQUEST_TIME && !this.requests[i].executed) {
                this.requests[i].requestTime = now
                randomIndex = getRandomInt(0, MAX_CONNECTIONS - 1)
                    // console.log("RE-REQUESTING", this.connections[randomIndex], this.requests[i].data)

                if (this.socketWriteAbstract(randomIndex, this.requests[i].data) == 2) {
                    this.connections[randomIndex].lastRequest = now
                }

            }
        }
    }

    netConnect(port, host, callback, i) {

        let reject, resolve

        const out = new Promise((resolveInner, rejectInner) => {
            resolve = resolveInner
            reject = resolveInner
        })

        var connection = net.connect(port, host, function() {
            resolve(1)
        })
        var now = Date.now()

        //Setting up callbacks
        connection.on("data", callback)

        connection.on("close", function(e) {
            // console.log("[] recieved close", e)
        })

        connection.on("connect", function(e) {
            // console.log("[] recieved connect", e)
        })

        connection.on("error", function(e) {
            // console.log("[] recieved error", e)
        })

        connection.on("onerror", function(e) {
            // console.log("[] recieved close", e)
        })

        connection.on("end", function(e) {
            // console.log("[] recieved end", e)
        })

        var conn = {
            conn: connection,
            lastRequest: now,
            lastResponse: now,
            prom: out
        }
        if (i == -1) {
            this.connections.push(conn)
        } else {
            this.connections[i] = conn
        }
    }

    connect() {

        var callback

        for (var i in this.serverList) {
            //compilig callback with right index
            callback = this.compileDataCallback(i)
            this.netConnect(this.serverList[i][1], this.serverList[i][0], callback, -1)
        }

        var this$1 = this

        setInterval(function() {
            this$1.collectGarbage()
        }, 400)
    }

    socketWriteAbstract(index, data) {
        if (this.connections[index].conn._state == 0) {
            // console.log("HAVE TO RECONNECT", this.connections[index].conn._state)
            var callback = this.compileDataCallback(index)
            this.netConnect(this.serverList[index][1], this.serverList[index][0], callback, index)
            return 0
        }

        if (this.connections[index].conn._state == 1) {
            var this$1 = this
            this.connections[index].prom.then(function() {
                this$1.connections[index].conn.write(data + "\n")
            })
            return 1
        }
        if (this.connections[index].conn._state == 2) {
            this.connections[index].conn.write(data + "\n")
            return 2
        }
    }

    write(data) {

        var hash = randomHash()

        var randomIndex = getRandomInt(0, MAX_CONNECTIONS - 1)

        data = data.replace("[ID]", hash)

        let reject, resolve

        const out = new Promise((resolveInner, rejectInner) => {
            resolve = resolveInner
            reject = resolveInner
        })

        this.requests[hash] = {
            data: data,
            executed: 0,
            connectionIndex: randomIndex,
            onDataReceived: resolve,
            onFailure: reject,
            requestTime: Date.now()
        }

        // console.log("writing into", randomIndex, data)

        var now = Date.now()

        this.connections[randomIndex].lastRequest = now

        this.socketWriteAbstract(randomIndex, data)

        return out
    }

    subscribeToAddress(wallet) {
        var requestString = '{ "id": "[ID]", "method":"blockchain.address.subscribe", "params": ["' + wallet + '"] }'
        return this.write(requestString)
    }

    handleData(data) {
        // console.log("Incoming data", data)
        if (data.method == "blockchain.address.subscribe" && data.params.length == 2) {
            this.incommingCallback(data.params[0], data.params[1])
            return
        }
        if (typeof this.requests[data.id] != "object")
            return
        if (this.requests[data.id].executed)
            return
        var now = Date.now()
        this.connections[this.requests[data.id].connectionIndex].lastResponse = now
        this.requests[data.id].executed = 1
        // // console.log("calling callback, ",data.id, data.result)
        this.requests[data.id].onDataReceived(data.result)
    }

    getTransaction(transactionID) {
        // console.log("Getting transaction ", transactionID)
        var requestString = '{ "id": "[ID]", "method":"blockchain.transaction.get", "params":["' + transactionID + '"] }'
        if (this.cache[transactionID]) {
            // console.log("USING CACHE", transactionID)
            var transaction = this.cache[transactionID].data
            return new Promise((resolve, reject) => {
                resolve(transaction)
            })
        } else {
            // console.log("NOT USING CACHE", transactionID)
        }
        return this.write(requestString)
    }

    getAddresHistory(wallet) {
        // console.log("Getting history for ", wallet)
        var requestString = '{ "id": "[ID]", "method":"blockchain.address.get_history", "params":["' + wallet + '"] }'
        return this.write(requestString)
    }

}

export {
    Electrum
}

