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
 *  - vehicle vsp.forward     …turn on when forward/drive is engaged
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
    forward: 'no',
    reverse: 'yes',
};

const state = {
    on: 0,
    speedSubscription: false,
};

const loadConfig = function () {
    Object.assign(config, OvmsConfig.GetValues('vehicle', 'vsp.'));
    config.speed = parseFloat(config.speed);
    exports.info();
};

const onForward = function () {
    print('Gear [F]\n');
    exports.set(config.forward === 'yes');
    if (config.speed && !state.speedSubscription) {
        print('Subscribing to speed\n');
        state.speedSubscription = PubSub.subscribe('ticker.1', speedHandler);
    }
};

const speedHandler = function () {
    const speed = OvmsMetrics.AsFloat('v.p.speed');
    print('speed [' + speed + ']\n');
    if (config.forward === 'yes') {
        exports.set(speed < config.speed);
    } else {
        exports.set(speed > 0.0 && speed <= config.speed);
    }
};

const onNeutral = function () {
    print('Gear [N]\n');
    turnOff();
};

const onReverse = function () {
    print('Gear [R]\n');
    exports.set(config.reverse === 'yes');
    if (state.speedSubscription) {
        print('Unsubscribing from speed\n');
        PubSub.unsubscribe(state.speedSubscription);
        state.speedSubscription = false;
    }
};

const turnOff = function () {
    print('Off\n');
    exports.set(0);
    if (state.speedSubscription) {
        print('Unsubscribing from speed\n');
        PubSub.unsubscribe(state.speedSubscription);
        state.speedSubscription = false;
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
        print('vsp state - changed to [' + state.on + ']\n');
    }
};

exports.info = function () {
    JSON.print({ config, state });
};

PubSub.subscribe('config.changed', loadConfig);
PubSub.subscribe('vehicle.gear.forward', onForward);
PubSub.subscribe('vehicle.gear.neutral', onNeutral);
PubSub.subscribe('vehicle.gear.reverse', onReverse);
PubSub.subscribe('vehicle.off', turnOff);

loadConfig();
