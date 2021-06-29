import csTools from 'cornerstone-tools';
import cornerstone from 'cornerstone-core';
import DICOMSegTempCrosshairsTool from './tools/DICOMSegTempCrosshairsTool';

/**
 *
 * @param {object} configuration
 * @param {Object|Array} configuration.csToolsConfig
 */
export default function init({ servicesManager, configuration = {} }) {
  const { BrushTool, SphericalBrushTool, CorrectionScissorsTool } = csTools;
  const tools = [BrushTool, SphericalBrushTool, CorrectionScissorsTool];

  const { UIDialogService, MeasurementService } = servicesManager.services;

  //load clinity config if exist (consider passing this module configuration from the backend server routes so it can be possible to load user preferences saved in database)
  if (window.config && window.config.segmentationConfig) {
    configuration = { ...configuration, ...window.config.segmentationConfig };
  } else {
    configuration = { ...configuration, uploadSegmentationsUrl: 'localhost:8001/resources/upload-dicom-seg' }
  }
  //set configuration
  const module = cornerstoneTools.getModule('segmentation');
  module.configuration = Object.assign({}, module.configuration, configuration);

  console.log('---------- --------- ------- --------')
  console.log(configuration)
  console.log(MeasurementService)

  tools.forEach(tool => csTools.addTool(tool));

  csTools.addTool(BrushTool, {
    name: 'BrushEraser',
    configuration: {
      alwaysEraseOnClick: true,
    },
  });

  csTools.addTool(DICOMSegTempCrosshairsTool);

  cornerstone.events.addEventListener(
    cornerstone.EVENTS.ELEMENT_ENABLED,
    event => {
      console.log('00000000000000000000000000000000000000', event)

    });

}
