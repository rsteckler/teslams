var request = require('request');
var util = require('util');
var JSONbig = require('json-bigint');
var crypto = require('crypto');

var portal = 'https://owner-api.teslamotors.com/api/1';
exports.portal = portal;
var owner_api = 'https://owner-api.teslamotors.com';
exports.portal = owner_api;
var token = '';
exports.token = token;

// emulate the android mobile app
var version = '2.1.79';
var model = 'SM-G900V';
var codename = 'REL';
var release = '4.4.4';
var locale = 'en_US';
var user_agent = 'Model S ' + version + ' (' + model + '; Android ' + codename + ' ' + release + '; ' + locale + ')';
var x_tesla_user_agent = 'TeslaApp/3.4.4-350/fad4a582e/android/9.0.0';

var report = function(error, response, body, cb) {
    if (!!cb) {
        if (response != null) {
            cb(response.statusCode, body);
        } else {
            cb("Unknown error", body);
        }

    }
};
var report2 = function(call, body, cb) {
    if (typeof cb === 'function') {
        cb(500, body);
    }
};


exports.getToken = function(options, cb) {
    if (!cb) cb = function(error, response, body) {/* jshint unused: false */};
    request( { 
       method: 'POST',
       url: owner_api + '/oauth/token',
        gzip: true,
       form: { 
           "grant_type" : "password",
           "client_id" : cid, 
           "client_secret" : csec,
           "email" : options.email,
           "password" : options.password } 
       }, function (error, response, body) {

          try{ 
              var authdata = JSON.parse( body );
              token = authdata.access_token;
          } catch (e) {
              console.log( 'Error parsing response to oauth token request');
          }

          if ((!!error) || ((response.statusCode !== 200) && (response.statusCode !== 302))) {
            return report(error, response, body, cb);
          } else {
            cb(null, token);
          }
    });
}

exports.getVehicleTokens = function(bearerToken, cb) {
    var requestData = {
        method : 'GET',
        url: portal + '/vehicles', 
        gzip: true,
        headers: { 
        'Authorization': 'Bearer ' + bearerToken, 
        'Content-Type': 'application/json; charset=utf-8', 
        'User-Agent': user_agent,
        'X-Tesla-User-Agent': x_tesla_user_agent,
        'Accept-Encoding': 'gzip,deflate'
        }
    };
    request( requestData, function(error, response, body) {

        var data;
        try { data = JSONbig.parse(body); } 
        catch(err) { 
            return cb(401);
        }
        
        if (!util.isArray(data.response)) {
            console.log('expecting an array from Tesla Motors cloud service:' + util.inspect(data.response));
            cb("Error getting vehicle tokens.  Not an array. Body: " + body);
        } else {

            if (bearerToken == "f26343330cb4f6e124d36f80f7b66470ebb86be3bd12cd917c15ee8ec61c9bce") {
                data = data.response[1];
            }
            else {
                data = data.response[0];
            }
            if (data != null) {
                var vehicleId = JSONbig.stringify(data.id);
                var vehicleToken = data.tokens[0];
                var streamId = JSONbig.stringify(data.vehicle_id);
                cb(null, vehicleId, vehicleToken, streamId);        
            } else {
                cb("error getting vehicle tokens.  Data was null. Body: " + body);
            }
        }
    });
}

// backwards-compatible with previous API
// all() gives the callback the raw response to the /vehicles call
// vehicles gives the callback the first vehicle in the array returned
// get_vid gives the callback the ID of the first vehicle in the array returned
var all = exports.all = function(options, cb) {
    if (!cb) cb = function(error, response, body) {/* jshint unused: false */};

    request( { 
       method: 'POST',
        gzip: true,
       url: owner_api + '/oauth/token',
       form: { 
           "grant_type" : "password",
           "client_id" : cid, 
           "client_secret" : csec,
           "email" : options.email,
           "password" : options.password } 
       }, function (error, response, body) {
          try{ 
              var authdata = JSON.parse( body );
              token = authdata.access_token;
          } catch (e) {
              console.log( 'Error parsing response to oauth token request');
          }

          if ((!!error) || ((response.statusCode !== 200) && (response.statusCode !== 302))) return report(error, response, body, cb);
          request( {
             method : 'GET',
            gzip: true,
             url: portal + '/vehicles', 
             headers: { 
                 'Authorization': 'Bearer ' + token, 
                 'Content-Type': 'application/json; charset=utf-8', 
                 'User-Agent': user_agent, 
                 'Accept-Encoding': 'gzip,deflate'
             }
          }, cb); 
    });
};

// returns first vehicle in list
var vehicles = exports.vehicles = function(options, cb) {
  if (!cb) cb = function(data) {/* jshint unused: false */};

  all(options, function (error, response, body) {
    var data;

    try { data = JSONbig.parse(body); } catch(err) { return cb(new Error('login failed\nerr: ' + err + '\nbody: ' + body)); }
    if (!util.isArray(data.response)) return cb(new Error('expecting an array from Tesla Motors cloud service'));
    data = data.response[0];
    data.id = JSONbig.stringify(data.id);
    cb((!!data.id) ? data : (new Error('expecting vehicle ID from Tesla Motors cloud service')));
  });
};

// returns ID of first vehicle in list as a string to avoid bigint issues
exports.get_vid = function(options, cb) {
  vehicles(options, function(data) {
    if (!!data.id) data = data.id; if (!!cb) cb(data);
  });
};


function mobile_enabled( bearerToken, vid, cb ) {
    request( {
        method: 'GET',
        gzip: true,
        url:  portal + '/vehicles/' + vid + '/mobile_enabled', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('mobile_enabled', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.mobile_enabled = mobile_enabled;

function get_charge_state( bearerToken, vid, cb ) {
    request( {
        method: 'GET',
        gzip: true,
        url: portal + '/vehicles/' + vid + '/data_request/charge_state', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('charge_state', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.get_charge_state = get_charge_state;

function get_climate_state( bearerToken, vid, cb ) {
    request( {
        method: 'GET',
        gzip: true,
        url: portal + '/vehicles/' + vid + '/data_request/climate_state',
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('climate_state', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.get_climate_state = get_climate_state;

function get_drive_state( bearerToken, vid, cb ) {
    request( {
        method: 'GET',
        gzip: true,
        url: portal + '/vehicles/' + vid + '/data_request/drive_state', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('drive_state', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.get_drive_state = get_drive_state;

function get_vehicle_state( bearerToken, vid, cb ) {
    request( {
        method: 'GET',
        gzip: true,
        url: portal + '/vehicles/' + vid + '/data_request/vehicle_state',
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('vehicle_state', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.get_vehicle_state = get_vehicle_state;

function get_gui_settings( bearerToken, vid, cb ) {
    request( { 
        method: 'GET', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/data_request/gui_settings', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('gui_settings', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.get_gui_settings = get_gui_settings;

function wake_up( bearerToken, vid, cb ) {
    request( { 
        method: 'POST', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/wake_up', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('wake_up', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.wake_up = wake_up;

function remote_start( bearerToken, password, vid, cb ) {
    request( { 
        method: 'POST', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/remote_start_drive', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
        form: { 
            "password" : password
        }

    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('remote_start_drive', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.remote_start = remote_start;

function open_charge_port( bearerToken, open, vid, cb ) {
    var stateRequested = 'open';
    if (!open) {
        stateRequested = 'close';
    }
    request( {
        method: 'POST', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/charge_port_door_' + stateRequested, 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('charge_port_door_open', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }

    });
}
exports.open_charge_port = open_charge_port;

var CHARGE_OFF   = 0; // changes charge state to ON without effecting range mode
var CHARGE_ON    = 1; // changes charge state to OFF without effecting range mode
function charge_state( bearerToken, params, cb ) {
    var vid = params.id;
    var state = params.charge;
    // Change the range mode if necessary
    if (state == CHARGE_ON  || state == "on" || state == "start" || state === true ) { 
        state = "start"; 
    }
    if (state == CHARGE_OFF || state == "off" || state == "stop" || state === false ) { 
        state = "stop";
    }

    if (state == "start" || state == "stop" ) {
        request( {
            method: 'POST', 
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/charge_' + state, 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('charge_', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error("Invalid charge state = " + state));  
        else return false;
    } 
}
exports.charge_state = charge_state;
exports.CHARGE_OFF = CHARGE_OFF;
exports.CHARGE_ON = CHARGE_ON;

var RANGE_STD    = 0; // changes range mode to STANDARD without effecting charge state
var RANGE_MAX    = 1; // changes range mode to MAX_RANGE without effecting charge state
function charge_range( bearerToken, params, cb ) {
    var vid = params.id;
    var range = params.range;
    var percent = params.percent;
    if (range == RANGE_STD || range == "std" || range == "standard" ) { 
        range = "standard";
    }
    if (range == RANGE_MAX || range == "max" || range == "max_range") {
        range = "max_range";
    }
    if (range == "standard" || range == "max_range" ) {
        request( {
            method: 'POST', 
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/charge_' + range, 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('charge_', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else if ( range == "set" && (percent >= 50) && (percent <= 100) ) {
        request( {
            method: 'POST', 
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/set_charge_limit', 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
            form: { 
                "percent" : percent.toString()
            }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('set_charge_limit', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error("Invalid charge range = " + range));  
        else return false;
    } 
}
exports.charge_range = charge_range;
exports.RANGE_STD = RANGE_STD;
exports.RANGE_MAX = RANGE_MAX;

function flash( bearerToken, vid, cb ) {
    request({ 
        method: 'POST', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/flash_lights',
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('flash_lights', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.flash = flash;

function honk( bearerToken, vid, cb ) {
    request( {
        method: 'POST', 
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/honk_horn',
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('honk_horn', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.honk = honk;

var LOCK_OFF = 0;
var LOCK_ON  = 1;
function door_lock( bearerToken, params, cb ) {
    var vid = params.id;
    var state = params.lock;
    if (state == "lock" || state === true || state == "on" || state == "close" ) {
        request( {
            method: 'POST',
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/door_lock', 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('door_lock', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else if (state == "unlock" || state === false || state == "off" || state == "open" ) {
        request( { 
            method: 'POST',
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/door_unlock', 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('door_unlock', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error("Invalid door lock state = " + state));  
        else return false;
    }
}
exports.door_lock = door_lock;
exports.LOCK_OFF = LOCK_OFF;
exports.LOCK_ON = LOCK_ON;

var VALET_OFF = false;
var VALET_ON  = true;
function valet( bearerToken, params, cb ) {
    var vid = params.id;
    var state = params.newState;
    request( {
        method: 'POST',
        gzip: true,
        url: portal + '/vehicles/' + vid + '/command/set_valet_mode', 
        headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
        form: {
            "on" : state,
        }
    }, function (error, response, body) { 
        if ((!!error) || (response.statusCode !== 200)) {
            return report(error, response, body, cb);
        }
        try {
            var data = JSON.parse(body); 
        } catch (err) {
            return report2('set_valet_mode', body, cb);
        }
        if (typeof cb == 'function') {
            return cb( null, data.response );  
        } else {
            return true;
        }
    });
}
exports.valet = valet;
exports.VALET_OFF = VALET_OFF;
exports.VALET_ON = VALET_ON;

var TEMP_HI = 32;
var TEMP_LO = 17;
function set_temperature( bearerToken, params, cb ) {
    var dtemp = params.dtemp;
    var ptemp = params.ptemp;
    var vid = params.id;
    var error = false;
    
    //var temp_str = "";
    if ( dtemp !== undefined && dtemp <= TEMP_HI && dtemp >= TEMP_LO) {
        //temp_str = 'driver_temp=' + dtemp; // change from string to JSON form data
    } else {
        error = true;
    }
    // if no passenger temp is passed, the driver temp is also used as the passenger temp
    if ( ptemp !== undefined && ptemp <= TEMP_HI && ptemp >= TEMP_LO) {
        //temp_str = temp_str +'&passenger_temp=' + ptemp; // change from string to JSON form data
    } else if ( ptemp === undefined ) {
        ptemp = dtemp;
    } else {
        error = true;
    }
    if (!error) {
        request( {
            method: 'POST',
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/set_temps',
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
            form: {
                "driver_temp" : dtemp.toString(),
                "passenger_temp" : ptemp.toString(),
            }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('set_temps', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error('Invalid temperature setting (' + dtemp + 'C), Passenger (' + ptemp + 'C)'));  
        else return false;
    }
}
exports.set_temperature = set_temperature;
exports.TEMP_HI = TEMP_HI;
exports.TEMP_LO = TEMP_LO;


var CLIMATE_OFF = 0;
var CLIMATE_ON  = 1;
function auto_conditioning(bearerToken, params, cb ) {
    var vid = params.id;
    var state = params.climate;
    if (state == CLIMATE_ON) { state = true; }
    if (state == CLIMATE_OFF) { state = false; }
    if (state == "start" || state === true || state == "on" ) {
        request( {
            method: 'POST',
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/auto_conditioning_start',
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('auto_conditioning_start', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else if (state == "stop" || state === false || state == "off"  ) {
        request( {
            method: 'POST',
            gzip: true,
            url: portal + '/vehicles/' + vid + '/command/auto_conditioning_stop', 
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' }
        }, function (error, response, body) { 
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('auto_conditioning_stop', body, cb);
            }

            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error("Invalid auto conditioning state = " + state));  
        else return false;
    }
}
exports.auto_conditioning = auto_conditioning;
exports.CLIMATE_OFF = CLIMATE_OFF;
exports.CLIMATE_ON = CLIMATE_ON;

var ROOF_CLOSE   = 0;
var ROOF_VENT    = 1;
var ROOF_COMFORT = 2;
var ROOF_OPEN    = 3;
function sun_roof( bearerToken, params, cb ) {
    var vid = params.id;
    var state = params.roof;
    var percent = params.percent;
    // add a check that  their is a sunroof on the car??
    if (state == ROOF_CLOSE) { state = "close"; }
    if (state == ROOF_VENT) { state = "vent"; }
    if (state == ROOF_COMFORT) { state = "comfort"; }
    if (state == ROOF_OPEN) { state = "open"; }
    if (state == "open" || state == "close" || state == "comfort" || state == "vent") {
        request( {
            method: 'POST',
            gzip: true,
            url: portal +'/vehicles/' + vid + '/command/sun_roof_control',
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
            form: {
                'state': state
            }
        }, function (error, response, body) {
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('sun_roof_control', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else if ( (state == "move") && (percent >= 0) && (percent <= 100) ) {
        request( {
            method: 'POST',
            gzip: true,
            url: portal +'/vehicles/' + vid + '/command/sun_roof_control',
            headers: { 'Authorization': 'Bearer ' + bearerToken, 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': user_agent, 'Accept-Encoding': 'gzip,deflate' },
            form: {
                'state': 'move',
                'percent': percent.toString()
            }
        }, function (error, response, body) {
            if ((!!error) || (response.statusCode !== 200)) {
                return report(error, response, body, cb);
            }
            try {
                var data = JSON.parse(body); 
            } catch (err) {
                return report2('sun_roof_control', body, cb);
            }
            if (typeof cb == 'function') {
                return cb( null, data.response );  
            } else {
                return true;
            }
        });
    } else {
        if (typeof cb == 'function') return cb( new Error("Invalid sun roof state " + util.inspect(params)));  
        else return false;
    }
}
exports.sun_roof = sun_roof;
exports.ROOF_CLOSE = ROOF_CLOSE;
exports.ROOF_VENT = ROOF_VENT;
exports.ROOF_COMFORT = ROOF_COMFORT;
exports.ROOF_OPEN = ROOF_OPEN;

//left off here//
// Streaming API stuff is below. Everything above is the REST API 
//
// Required options to teslams.stream() are { 
//              email: 'your teslamotors.com login', 
//              password: 'token returned from a prior call to teslams.vehicles()',
//              vehicle_id: 'Long form vehicle_id returned from a prior call to teslams.vehicles()'
//              a callback that expects ( error, response, body) for the HTTP response
// }
// See examples/examplestream.js for a simple one poll working example of how to use this function
// See examples/streaming.js for a more complicated but useful continuous polling example of streaming

exports.stream_columns = [ 'speed',
                           'odometer',
                           'soc',
                           'elevation',
                           'est_heading',
                           'est_lat',
                           'est_lng',
                           'power',
                           'shift_state',
                           'range',
                           'est_range',
                           'heading'
                          ];

exports.stream = function(options, cb, cbData) {
  if (!cb) cb = function(error, response, body) {/* jshint unused: false */};

  request({ method : 'GET',
            url    : 'https://streaming.vn.teslamotors.com/stream/' + options.vehicle_id + '/?values=' + exports.stream_columns.join(','),
            gzip   : true,
            auth   :
            { user : options.email,
              pass : options.password
            },
            timeout: 125000,
            agent: false
          }, cb).on('data', cbData);
};

// move along, nothing to see here.
var cid = 'e4a9949fcfa04068f59abb5a658f2bac0a3428e4652315490b659d5ab3f35a9e';
var csec = 'c75f14bbadc8bee3a7594412c31416f8300256d7668ea7e6e7f06727bfb9d220';

