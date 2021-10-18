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
    tickerSubscription: false,
};

const loadConfig = function () {
    Object.assign(config, OvmsConfig.GetValues('vehicle', 'vsp.'));
    config.speed = parseFloat(config.speed);
    exports.info();
};

const setup = function () {
    print('setup\n');
    loadConfig();
    if (!state.tickerSubscription) {
        state.tickerSubscription = PubSub.subscribe('ticker.1', onTicker);
        print('Ticker subscribed\n');
    }
};

const tearDown = function () {
    print('tearDown');
    exports.set(0);
    if (state.tickerSubscription) {
        PubSub.unsubscribe(state.tickerSubscription);
        state.tickerSubscription = false;
        print('Ticker unsubscribed\n');
    }
};

const onTicker = function () {
    const gear = OvmsMetrics.AsFloat('v.e.gear');
    const speed = OvmsMetrics.AsFloat('v.p.speed');
    print('vsp - gear [' + gear + '] speed [' + speed + ']\n');
    if (gear > 0) {
        // We're going forward (or are about to).
        if (config.drive === 'yes') {
            if (config.speed) {
                exports.set(speed < config.speed);
            } else {
                exports.set(1);
            }
        } else {
            exports.set(speed > 0.0 && speed <= config.speed);
        }
    } else if (gear < 0) {
        // We're in reverse
        exports.set(config.reverse === 'yes');
    } else {
        // Neutral and maybe park. For now we just turn off.
        exports.set(0);
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
        print('vsp state - changed\n');
    }
};

exports.info = function () {
    JSON.print({ config, state });
};

PubSub.subscribe('config.changed', loadConfig);
PubSub.subscribe('vehicle.on', setup);
PubSub.subscribe('vehicle.off', tearDown);

loadConfig();
