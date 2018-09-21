import { IConfiguration, AppInsightsCore, IAppInsightsCore, LoggingSeverity, _InternalMessageId } from "applicationinsights-core-js";
import { ApplicationInsights  as AppInsightsInternal, IAppInsights, IPageViewTelemetry, IExceptionTelemetry, IAutoExceptionTelemetry, ITraceTelemetry, IMetricTelemetry } from "applicationinsights-analytics-js";
import { Util, IConfig } from "applicationinsights-common";
import { Sender } from "applicationinsights-channel-js";
import { PropertiesPlugin } from "applicationinsights-properties-js";

"use strict";

export interface Snippet {
    queue: Array<() => void>;
    config: IConfiguration;
}

// ToDo: Implement the interfaces to expose apis
export class ApplicationInsights implements IAppInsights {
    trackPageView(pageView: IPageViewTelemetry, customProperties?: { [key: string]: any; }) {
        this.appInsights.trackPageView(pageView, customProperties);
    }
    trackException(exception: IExceptionTelemetry, customProperties?: { [key: string]: any; }): void {
        this.appInsights.trackException(exception, customProperties);
    }
    _onerror(exception: IAutoExceptionTelemetry): void {
        this.appInsights._onerror(exception);
    }
    trackTrace(trace: ITraceTelemetry, customProperties?: { [key: string]: any; }): void {
        this.trackTrace(trace, customProperties);
    }
    trackMetric(metric: IMetricTelemetry, customProperties?: { [key: string]: any; }): void {
        this.trackMetric(metric, customProperties);
    }
    
    public snippet: Snippet;
    public config: IConfiguration;
    private core: IAppInsightsCore;
    private appInsights: AppInsightsInternal;
    private properties: PropertiesPlugin;

    constructor(snippet: Snippet) {

        // initialize the queue and config in case they are undefined
        snippet.queue = snippet.queue || [];
        AppInsightsInternal.Version = "2.0.0";

        let config : IConfiguration = snippet.config;
        // ensure instrumentationKey is specified
        if (!config) {
            // set default values using config passed through snippet
            config = ApplicationInsights.getDefaultConfig(config, this.appInsights.identifier);
        }


        this.appInsights = new AppInsightsInternal();

        this.properties = new PropertiesPlugin();

        this.snippet = snippet;
        this.config = config;
        this.loadAppInsights();
    }

    public loadAppInsights() {

        this.core = new AppInsightsCore();
        let extensions = [];
        let appInsightsChannel: Sender = new Sender(this.core.logger);
        
        extensions.push(appInsightsChannel);
        extensions.push(this.properties);
        extensions.push(this.appInsights);
        
        // initialize core
        this.core.initialize(this.config, extensions);
        if (!this.config.instrumentationKey) {
            this.core.logger.warnToConsole("No instrumentation key specified");
        }

        // initialize extensions
        this.appInsights.initialize(this.config, this.core, extensions);
        appInsightsChannel.initialize(this.config);
    }

    public emptyQueue() {

        // call functions that were queued before the main script was loaded
        try {
            if (Util.isArray(this.snippet.queue)) {
                // note: do not check length in the for-loop conditional in case something goes wrong and the stub methods are not overridden.
                var length = this.snippet.queue.length;
                for (var i = 0; i < length; i++) {
                    var call = this.snippet.queue[i];
                    call();
                }

                this.snippet.queue = undefined;
                delete this.snippet.queue;
            }
        } catch (exception) {
            var properties: any = {};
            if (exception && typeof exception.toString === "function") {
                properties.exception = exception.toString();
            }

            this.core.logger.throwInternal(
                LoggingSeverity.WARNING,
                _InternalMessageId.FailedToSendQueuedTelemetry,
                "Failed to send queued telemetry",
                properties);
        }
    }

    //public pollInteralLogs(appInsightsInstance: AppInsightsInternal) {
        // remove when  e2e works
        // return setInterval(() => {
        //     var queue: Array<_InternalLogMessage> = ApplicationInsights._InternalLogging.queue;
        //     var length = queue.length;
        //     for (var i = 0; i < length; i++) {
        //         appInsightsInstance.trackTrace(queue[i].message);
        //     }
        //     queue.length = 0;
        // }, this.config.diagnosticLogInterval);
    //}

    public addHousekeepingBeforeUnload(): void {
        // Add callback to push events when the user navigates away

        if (!(<any>this.config).disableFlushOnBeforeUnload && ('onbeforeunload' in window)) {
            var performHousekeeping = function () {
                // Adds the ability to flush all data before the page unloads.
                // Note: This approach tries to push an async request with all the pending events onbeforeunload.
                // Firefox does not respect this.Other browsers DO push out the call with < 100% hit rate.
                // Telemetry here will help us analyze how effective this approach is.
                // Another approach would be to make this call sync with a acceptable timeout to reduce the 
                // impact on user experience.

                this.core.getTransmissionControls().forEach(element => {
                    if (element.length > 0) {
                        element.forEach(e => e.flush(true));
                    }
                });
                // Back up the current session to local storage
                // This lets us close expired sessions after the cookies themselves expire
                this.properties._sessionManager.backup();
            };

            if (!Util.addEventHandler('beforeunload', performHousekeeping)) {
                this.core.logger.throwInternal(
                    LoggingSeverity.CRITICAL,
                    _InternalMessageId.FailedToAddHandlerForOnBeforeUnload,
                    'Could not add handler for beforeunload');
            }
        }
    }

    public static getDefaultConfig(configuration?: IConfiguration, identifier?: string): IConfiguration {
        if (!configuration) {
            configuration = <IConfiguration>{};
        }
        identifier = identifier ? identifier : "ApplicationInsightsAnalytics";


        let config = configuration.extensions ? <IConfig>configuration.extensions[identifier] : {};

        // set default values
        configuration.endpointUrl = configuration.endpointUrl || "https://dc.services.visualstudio.com/v2/track";
        config.sessionRenewalMs = 30 * 60 * 1000;
        config.sessionExpirationMs = 24 * 60 * 60 * 1000;

        config.enableDebug = Util.stringToBoolOrDefault(config.enableDebug);
        config.disableExceptionTracking = Util.stringToBoolOrDefault(config.disableExceptionTracking);
        config.consoleLoggingLevel = config.consoleLoggingLevel || 1; // Show only CRITICAL level
        config.telemetryLoggingLevel = config.telemetryLoggingLevel || 0; // Send nothing
        config.diagnosticLogInterval = config.diagnosticLogInterval || 10000;
        config.autoTrackPageVisitTime = Util.stringToBoolOrDefault(config.autoTrackPageVisitTime);

        if (isNaN(config.samplingPercentage) || config.samplingPercentage <= 0 || config.samplingPercentage >= 100) {
            config.samplingPercentage = 100;
        }

        config.disableAjaxTracking = Util.stringToBoolOrDefault(config.disableAjaxTracking)
        config.maxAjaxCallsPerView = !isNaN(config.maxAjaxCallsPerView) ? config.maxAjaxCallsPerView : 500;

        config.disableCorrelationHeaders = Util.stringToBoolOrDefault(config.disableCorrelationHeaders);
        config.correlationHeaderExcludedDomains = config.correlationHeaderExcludedDomains || [
            "*.blob.core.windows.net",
            "*.blob.core.chinacloudapi.cn",
            "*.blob.core.cloudapi.de",
            "*.blob.core.usgovcloudapi.net"];
        config.disableFlushOnBeforeUnload = Util.stringToBoolOrDefault(config.disableFlushOnBeforeUnload);
        config.isCookieUseDisabled = Util.stringToBoolOrDefault(config.isCookieUseDisabled);
        config.isStorageUseDisabled = Util.stringToBoolOrDefault(config.isStorageUseDisabled);
        config.isBrowserLinkTrackingEnabled = Util.stringToBoolOrDefault(config.isBrowserLinkTrackingEnabled);
        config.enableCorsCorrelation = Util.stringToBoolOrDefault(config.enableCorsCorrelation);

        return configuration;
    }
}