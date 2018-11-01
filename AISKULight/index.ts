// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IConfiguration, AppInsightsCore, IAppInsightsCore, LoggingSeverity, _InternalMessageId, CoreUtils, ITelemetryItem } from "@microsoft/applicationinsights-core-js";
import { Sender } from "@microsoft/applicationinsights-channel-js";

"use strict";

/**
 * @export
 * @class ApplicationInsights
 */
export class ApplicationInsights {
    public config: IConfiguration;
    private core: IAppInsightsCore;

    /**
     * Creates an instance of ApplicationInsights.
     * @param {IConfiguration} config
     * @memberof ApplicationInsights
     */
    constructor(config: IConfiguration) {

        // initialize the queue and config in case they are undefined
        if (CoreUtils.isNullOrUndefined(config) || CoreUtils.isNullOrUndefined(config.instrumentationKey)) {
            throw new Error("Invalid input configuration");
        }

        this.initialize();
    }

    /**
     * Initialize this instance of ApplicationInsights 
     *
     * @memberof ApplicationInsights
     */
    public initialize(): void {

        this.core = new AppInsightsCore();
        let extensions = [];
        let appInsightsChannel: Sender = new Sender();

        extensions.push(appInsightsChannel);

        // initialize core
        this.core.initialize(this.config, extensions);

        // initialize extensions
        appInsightsChannel.initialize(this.config, this.core, extensions);
    }

    /**
     * Send a manually constructed custom event
     *
     * @param {ITelemetryItem} item
     * @memberof ApplicationInsights
     */
    public track(item: ITelemetryItem) {
        this.core.track(item);
    }
}