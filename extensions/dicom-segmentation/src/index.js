import React from 'react';

import init from './init.js';
import toolbarModule from './toolbarModule.js';
import getSopClassHandlerModule from './getOHIFDicomSegSopClassHandler.js';
import SegmentationPanel from './components/SegmentationPanel/SegmentationPanel.js';
import commandsModule from './commandsModule.js';

export default {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'com.ohif.dicom-segmentation',

  /**
   *
   *
   * @param {object} [configuration={}]
   * @param {object|array} [configuration.csToolsConfig] - Passed directly to `initCornerstoneTools`
   */
  preRegistration({ servicesManager, configuration = {} }) {
    init({ servicesManager, configuration });
  },
  getToolbarModule({ servicesManager }) {
    return toolbarModule;
  },
  getCommandsModule({ servicesManager }) {

    return commandsModule;
  },
  getPanelModule({ commandsManager, api, servicesManager }) {
    const { UINotificationService } = servicesManager.services;
    console.log('.,-.,-.,-.,-.,-.,-.,.,.-,.-.,.,-.-.,')
    console.log(commandsManager, api, servicesManager)




    document.addEventListener('extensiondicomsegmentationsegloaded', event => {
      //const enabledElements = cornerstone.getEnabledElements();
      //const element = enabledElements[0].element;

      // element.addEventListener('cornersontetoolslabelmapmodified', event => {
      //   event.stopPropagation()
      //   console.log('blablablablabla', event);

      //   // const module = cornerstoneTools.getModule('segmentation');
      //   // const activeViewport = viewports[activeIndex];
      //   // const studyMetadata = studyMetadataManager.get(
      //   //   activeViewport.StudyInstanceUID
      //   // );
      //   // const firstImageId = studyMetadata.getFirstImageId(
      //   //   activeViewport.displaySetInstanceUID
      //   // );
      //   // updateState('brushStackState', module.state.series[firstImageId]);

      // });

    });


    window.MeasurementService = servicesManager.services.MeasurementService

    const ExtendedSegmentationPanel = props => {
      const { activeContexts } = api.hooks.useAppContext();

      const onDisplaySetLoadFailureHandler = error => {
        console.log('---->----->----> ', error)
        UINotificationService.show({
          title: 'DICOM Segmentation Loader',
          message: error.message,
          type: 'error',
          autoClose: false,
        });
      };

      const segmentItemClickHandler = data => {
        console.log(data)
        const enabledElements = cornerstone.getEnabledElements()
        const element = enabledElements[data.activeViewportIndex].element
        const module = cornerstoneTools.getModule('segmentation');
        const activeLabelmapIndex = module.getters.labelmaps3D(element).activeLabelmapIndex
        const labelmap3D = module.getters.labelmaps3D(element).labelmaps3D[activeLabelmapIndex];
        console.log(labelmap3D.activeSegmentIndex)

        commandsManager.runCommand('jumpToImage', data);
        commandsManager.runCommand('jumpToSlice', data);
      };

      const onSegmentVisibilityChangeHandler = (segmentNumber, visible) => {
        commandsManager.runCommand('setSegmentConfiguration', {
          segmentNumber,
          visible,
        });
      };

      const onConfigurationChangeHandler = configuration => {
        commandsManager.runCommand('setSegmentationConfiguration', {
          globalOpacity: configuration.fillAlpha,
          outlineThickness: configuration.outlineWidth,
          renderOutline: configuration.renderOutline,
          visible: configuration.renderFill,
        });
      };

      const onSelectedSegmentationChangeHandler = () => {
        commandsManager.runCommand('requestNewSegmentation');
      };

      return (
        <SegmentationPanel
          {...props}
          activeContexts={activeContexts}
          contexts={api.contexts}
          onSegmentItemClick={segmentItemClickHandler}
          onSegmentVisibilityChange={onSegmentVisibilityChangeHandler}
          onConfigurationChange={onConfigurationChangeHandler}
          onSelectedSegmentationChange={onSelectedSegmentationChangeHandler}
          onDisplaySetLoadFailure={onDisplaySetLoadFailureHandler}
        />
      );
    };

    return {
      menuOptions: [
        {
          icon: 'list',
          label: 'Segmentations',
          target: 'segmentation-panel',
          isDisabled: false /* studies => {
            if (!studies) {
              return true;
            }

            for (let i = 0; i < studies.length; i++) {
              const study = studies[i];

              if (study && study.series) {
                for (let j = 0; j < study.series.length; j++) {
                  const series = study.series[j];

                  if (series.Modality === 'SEG') {
                    return false;
                  }
                }
              }
            }

            return true;
          },*/
        },
      ],
      components: [
        {
          id: 'segmentation-panel',
          component: ExtendedSegmentationPanel,
        },
      ],
      defaultContext: ['VIEWER'],
    };
  },
  getSopClassHandlerModule,

};
