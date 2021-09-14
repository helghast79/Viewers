import React from 'react';
import OHIF from '@ohif/core';

import init from './init.js';
import toolbarModule from './toolbarModule.js';
import getSopClassHandlerModule from './getOHIFDicomSegSopClassHandler.js';
import SegmentationPanel from './components/SegmentationPanel/SegmentationPanel.js';
import commandsModule from './commandsModule.js';
import { version } from '../package.json';
import { SimpleDialog } from '@ohif/ui';
import RelabelSegmentModal from './components/RelabelSegmentModal/RelabelSegmentModal.js';
import { SimpleConfirmDialog } from './components/SimpleConfirmDialog/SimpleConfirmDialog.js';



const { studyMetadataManager } = OHIF.utils;

export default {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'com.cliniti',
  version,

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

    return commandsModule(servicesManager);
  },
  getPanelModule({ commandsManager, api, servicesManager }) {
    const { UINotificationService, UIModalService, UIDialogService } = servicesManager.services;
    console.log('popopopo', api)
    const callInputDialog = (title, label, currentValue, callback) => {
      if (UIDialogService) {
        let dialogId = UIDialogService.create({
          centralize: true,
          isDraggable: false,
          content: SimpleDialog.InputDialog,
          useLastPosition: false,
          showOverlay: true,
          contentProps: {
            title: title,
            label: label,
            defaultValue: currentValue || '',
            onClose: () => UIDialogService.dismiss({ id: dialogId }),
            onSubmit: value => {
              callback(value);
              UIDialogService.dismiss({ id: dialogId });
            },
          },
        });
      }
    };

    const callConfirmDialog = (title, message, callback) => {
      if (UIDialogService) {
        let dialogId = UIDialogService.create({
          centralize: true,
          isDraggable: false,
          content: SimpleConfirmDialog.ConfirmDialog,
          useLastPosition: false,
          showOverlay: true,
          contentProps: {
            title: title,
            message: message,
            onClose: () => UIDialogService.dismiss({ id: dialogId }),
            onSubmit: () => {
              callback();
              UIDialogService.dismiss({ id: dialogId });
            },
          },
        });
      }
    };



    const callRelabelSegmentModal = (labelmap3D, segmentIndex, callback) => {
      if (UIModalService) {

        const onSubmit = ({ type, subtype, modifier, label }) => {
          UIModalService.hide();
          callback({ type, subtype, modifier, label });
        }

        const WrappedRelabelSegmentModal = function () {
          return (
            <RelabelSegmentModal
              labelmap3D={labelmap3D}
              segmentIndex={segmentIndex}
              confirm={onSubmit}
              cancel={() => { UIModalService.hide(); }}
            />
          );
        };

        UIModalService.show({
          content: WrappedRelabelSegmentModal,
          title: `Relabel Segment`,
          shouldCloseOnEsc: true,
          closeButton: false,
          fullscreen: true,
        });
      }
    }




    document.addEventListener('extensiondicomsegmentationsegselected', event => {
      const { activatedLabelmapIndex } = event.detail
      console.log('Segmentation selected #', activatedLabelmapIndex);
    });




    const ExtendedClinitiPanel = props => {
      const { activeContexts } = api.hooks.useAppContext();

      const onDisplaySetLoadFailureHandler = error => {

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
          dialogFunction={callInputDialog}
          deleteDialogFunction={callConfirmDialog}
          relabelSegmentModal={callRelabelSegmentModal}
        />
      );
    };

    const ClinitiPanelTabUpdatedEvent = 'cliniti-panel-tab-updated';

    /**
     * Trigger's an event to update the state of the panel's RoundedButtonGroup.
     *
     * This is required to avoid extension state
     * coupling with the viewer's ToolbarRow component.
     *
     * @param {object} data
     */
    const triggerClinitiPanelTabUpdatedEvent = data => {
      const event = new CustomEvent(ClinitiPanelTabUpdatedEvent, {
        detail: data,
      });
      document.dispatchEvent(event);
    };



    const onSegmentationsLoaded = ({ detail }) => {
      const {
        imageIds,
        labelmapBuffer,
        labelmapSegments,
        segDisplaySet,
        segMetadata,
        segmentsOnFrame
      } = detail

      const studyMetadata = studyMetadataManager.get(
        segDisplaySet.StudyInstanceUID
      );
      const referencedDisplaysets = studyMetadata.getDerivedDatasets({
        referencedSeriesInstanceUID: segMetadata.seriesInstanceUid,
        Modality: 'SEG',
      });
      triggerClinitiPanelTabUpdatedEvent({
        badgeNumber: referencedDisplaysets.length,
        target: 'cliniti-panel',
      });

      if (UINotificationService) {
        UINotificationService.show({
          title: 'Segmentation loaded successfully',
          message: `${segmentsOnFrame.length} segment${segmentsOnFrame.length > 1 ? 's' : ''} loaded`,
          duration: 2000,
          position: 'bottomCenter',//topLeft | topCenter | topRight | bottomLeft | bottomCenter | bottomRight
          type: 'info', //info | error | warning | success
          autoClose: true,
        });
      }
    };




    document.addEventListener(
      'extensiondicomsegmentationsegloaded',
      onSegmentationsLoaded
    );

    return {
      menuOptions: [
        {
          icon: 'list',
          label: 'Cliniti',
          target: 'cliniti-panel',
          stateEvent: ClinitiPanelTabUpdatedEvent,
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
          id: 'cliniti-panel',
          component: ExtendedClinitiPanel,
        },
      ],
      defaultContext: ['VIEWER'],
    };
  },
  getSopClassHandlerModule,

};
