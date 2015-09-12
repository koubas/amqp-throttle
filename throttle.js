var AMQP = require('amqp');
var config = require('./config');

const PREFETCH = 20;
const CREDITS_TICK_INTERVAL = 50;
const CREDITS_PER_TICK = 5;
const MAX_CREDITS = 100;

var creditBalance = CREDITS_PER_TICK;
var creditsAvailableCallbacks = [];

var exchange = null;

var conn = AMQP.createConnection(config.connection_options);
conn.on('ready', function(){
    exchange = conn.exchange(config.destination.exchange, config.destination.options, function(ex){
        conn.queue(config.source.queue, config.source.options, function(queue){
            queue.subscribe({ ack: true, prefetchCount: PREFETCH }, function(message, headers, deliveryInfo, msgObj){
                messageCruncher(message, headers, deliveryInfo, msgObj);
            });
        });
    });
});

var messageCruncher = function(message, headers, deliveryInfo, msgObj) {
    if (creditBalance <= 0) {
        creditsAvailableCallbacks.push(function() {
            messageCruncher(message, headers, deliveryInfo, msgObj);
        });
        return;
    }

    creditBalance--;

    var options = {
        headers: headers,
        contentType: message.contentType,
        deliveryMode: 2,
        mandatory: true
    };
    exchange.publish(config.destination.routing_key, message, options, function(err) {
        if (err) {
            console.log('Publish error, source message redelivered');
            msgObj.reject(true);
        } else {
            msgObj.acknowledge(false);
        }
    });
};

setInterval(function(){
    var prevBalance = creditBalance;
    if (creditBalance < MAX_CREDITS) {
        creditBalance += CREDITS_PER_TICK;
    }
    if (prevBalance == 0 && creditBalance > 0) {
        var callback;
        while (undefined !== (callback = creditsAvailableCallbacks.shift())) {
            process.nextTick(callback);
        }
    }
}, CREDITS_TICK_INTERVAL);