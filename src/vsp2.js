/**
 * /store/scripts/lib/vsp.js
 *
 * Module plugin:
 *  OVMS Vehicle Sound for Pedestrians (VSP).
 *
 * Version 1.0   Biddster <@biddster>
 *
 * Based on foglight.js by Michael Balzer <dexter@dexters-web.de>
 *
 * Enable:
 *  - install at above path
 *  - add to /store/scripts/ovmsmain.js:
 *        vsp = require("lib/vsp");
 *  - script reload
 *
 * Config:
 *  - vehicle vsp.port        …EGPIO output port number
 *  - vehicle vsp.speed       …turn off above this speed when in drive
 *  - vehicle vsp.drive       …turn on when drive is engaged
 *  - vehicle vsp.reverse     …turn on when reverse is engaged
 *
 * Usage:
 *  - script eval vsp.set(1)  …turn vsp on
 *  - script eval vsp.set(0)  …turn vsp off
 *  - script eval vsp.info()  …show config & state (JSON)
 *
 */

const config = {
    port: '1',
    speed: '0.0',
    drive: 'no',
    reverse: 'no',
};

const state = {
    on: 0,
    speedSubscription: false,
    forwardSubscription: false,
    reverseSubscription: false,
    neutralSubscription: false,
};

const loadConfig = function () {
    Object.assign(config, OvmsConfig.GetValues('vehicle', 'vsp.'));
    config.speed = parseFloat(config.speed);
    exports.info();
};

const setup = function () {
    print('setup\n');
    loadConfig();

    subscribe('forwardSubscription', 'vehicle.gear.forward', function () {
        print('Drive engaged\n');
        exports.set(config.drive === 'yes');
        if (config.speed) {
            subscribe('speedSubscription', 'ticker.1', function () {
                const speed = OvmsMetrics.AsFloat('v.p.speed');
                print('vsp - speed [' + speed + ']\n');
                if (config.drive === 'yes') {
                    exports.set(speed < config.speed);
                } else {
                    exports.set(speed > 0.0 && speed <= config.speed);
                }
            });
        }
    });

    subscribe('reverseSubscription', 'vehicle.gear.reverse', function () {
        print('Reverse engaged\n');
        unsubscribe('speedSubscription');
        exports.set(config.reverse === 'yes');
    });

    subscribe('neutralSubscription', 'vehicle.gear.neutral', function () {
        print('Neutral engaged\n');
        unsubscribe('speedSubscription');
        exports.set(0);
    });
};

const tearDown = function () {
    print('tearDown');
    exports.set(0);
    unsubscribe('speedSubscription');
    unsubscribe('forwardSubscription');
    unsubscribe('reverseSubscription');
    unsubscribe('neutralSubscription');
};

const subscribe = function (stateProperty, event, func) {
    if (!state[stateProperty]) {
        state[stateProperty] = PubSub.subscribe(event, func);
        print('Subscribed [' + stateProperty + '] [' + event + ']\n');
    }
};

const unsubscribe = function (stateProperty) {
    if (state[stateProperty]) {
        PubSub.unsubscribe(state[stateProperty]);
        state[stateProperty] = false;
        print('Unsubscribed [' + stateProperty + ']\n');
    }
};

exports.set = function (onoff) {
    const newState = onoff ? 1 : 0;
    print(
        'vsp state - requested [' +
            onoff +
            '] new [' +
            newState +
            '] current [' +
            state.on +
            ']\n'
    );

    if (newState !== state.on) {
        OvmsCommand.Exec('egpio output ' + config.port + ' ' + newState);
        OvmsCommand.Exec('event raise usr.vsp.' + (newState ? 'on' : 'off'));
        state.on = newState;
        print('vsp state - changed to [' + newState + ']\n');
    }
};

exports.info = function () {
    JSON.print({ config, state });
};

PubSub.subscribe('config.changed', loadConfig);
PubSub.subscribe('vehicle.on', setup);
PubSub.subscribe('vehicle.off', tearDown);

loadConfig();
