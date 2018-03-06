'use strict';

var _ = require('lodash');
var moment = require('moment');
var levels = require('../levels');

function init(ctx) {
    var translate = ctx.language.translate;
    
    var lage = {
    name: 'bage'
        , label: 'Pump Battery Change'
        , pluginType: 'pill-minor'
    };
    
    bage.getPrefs = function getPrefs(sbx) {
        return {
        info: sbx.extendedSettings.info || times.days(13).hours
            , warn: sbx.extendedSettings.warn || (times.days(14).hours - 4)
            , urgent: sbx.extendedSettings.urgent || (times.days(15).hours - 2)
            , enableAlerts: sbx.extendedSettings.enableAlerts || false
        };
    };
    
    bage.setProperties = function setProperties (sbx) {
        sbx.offerProperty('bage', function setProp ( ) {
                          return bage.findLatestTimeChange(sbx);
                          });
    };
    
    bage.checkNotifications = function checkNotifications(sbx) {
        var pbatteryInfo = sbx.properties.bage;
        
        if (pbatteryInfo.notification) {
            var notification = _.extend({}, pbatteryInfo.notification, {
                plugin: bage
                , debug: {
                  age: pbatteryInfo.age
                }
            });
            sbx.notifications.requestNotify(notification);
        }
    };
    
    bage.findLatestTimeChange = function findLatestTimeChange(sbx) {
        
        var prefs = bage.getPrefs(sbx);
        
        var pbatteryInfo = {
        found: false
            , age: 0
            , treatmentDate: null
            , checkForAlert: false
        };
        
        var prevDate = 0;
        
        _.each(sbx.data.batterychangeTreatments, function eachTreatment (treatment) {
               var treatmentDate = treatment.mills;
               if (treatmentDate > prevDate && treatmentDate <= sbx.time) {
               
               prevDate = treatmentDate;
               pbatteryInfo.treatmentDate = treatmentDate;
               
               var a = moment(sbx.time);
               var b = moment(pbatteryInfo.treatmentDate);
               var days = a.diff(b,'days');
               var hours = a.diff(b,'hours') - days * 24;
               var age = a.diff(b,'hours');
               
               if (!pbatteryInfo.found || (age >= 0 && age < pbatteryInfo.age)) {
               pbatteryInfo.found = true;
               pbatteryInfo.age = age;
               pbatteryInfo.days = days;
               pbatteryInfo.hours = hours;
               pbatteryInfo.notes = treatment.notes;
               pbatteryInfo.minFractions = a.diff(b,'minutes') - age * 60;
               }
               }
               });

        
        pbatteryInfo.level = levels.NONE;
        
        var sound = 'incoming';
        var message;
        var sendNotification = false;
        
        if (pbatteryInfo.age >= prefs.urgent) {
            sendNotification = pbatteryInfo.age === prefs.urgent;
            message = translate('Pump Battery change overdue!');
            sound = 'persistent';
            pbatteryInfo.level = levels.URGENT;
        } else if (pbatteryInfo.age >= prefs.warn) {
            sendNotification = pbatteryInfo.age === prefs.warn;
            message = translate('Time to change pump battery');
            pbatteryInfo.level = levels.WARN;
        } else  if (pbatteryInfo.age >= prefs.info) {
            sendNotification = pbatteryInfo.age === prefs.info;
            message = 'Change pump battery soon';
            pbatteryInfo.level = levels.INFO;
        }
        
        if (prefs.display === 'days' && pbatteryInfo.found) {
            pbatteryInfo.display = '';
            if (pbatteryInfo.age >= 24) {
                pbatteryInfo.display += pbatteryInfo.days + 'd';
            }
            pbatteryInfo.display += pbatteryInfo.hours + 'h';
        } else {
            pbatteryInfo.display = pbatteryInfo.found ? pbatteryInfo.age + 'h' : 'n/a ';
        }
        
        //allow for 20 minute period after a full hour during which we'll alert the user
        if (prefs.enableAlerts && sendNotification && pbatteryInfo.minFractions <= 20) {
            pbatteryInfo.notification = {
            title: translate('Pump battery age %1 hours', { params: [pbatteryInfo.age] })
                , message: message
                , pushoverSound: sound
                , level: pbatteryInfo.level
                , group: 'BAGE'
            };
        }
        
        return pbatteryInfo;
    };

    bage.updateVisualisation = function updateVisualisation (sbx) {
        
        var pbatteryInfo = sbx.properties.bage;
        
        var info = [{ label: translate('Inserted'), value: new Date(pbatteryInfo.treatmentDate).toLocaleString() }];
        
        if (!_.isEmpty(pbatteryInfo.notes)) {
            info.push({label: translate('Notes') + ':', value: pbatteryInfo.notes});
        }
        
        var statusClass = null;
        if (pbatteryInfo.level === levels.URGENT) {
            statusClass = 'urgent';
        } else if (pbatteryInfo.level === levels.WARN) {
            statusClass = 'warn';
        }
        
        sbx.pluginBase.updatePillText(bage, {
                                      value: pbatteryInfo.display
                                      , label: translate('BAGE')
                                      , info: info
                                      , pillClass: statusClass
                                      });
    };
    return bage;
}

module.exports = init;
