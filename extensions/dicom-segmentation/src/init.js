import csTools from 'cornerstone-tools';
import cornerstone from 'cornerstone-core';

/**
 *
 * @param {object} configuration
 * @param {Object|Array} configuration.csToolsConfig
 */
export default function init({ servicesManager, configuration = {} }) {
  const { BrushTool, SphericalBrushTool, CorrectionScissorsTool } = csTools;
  const tools = [BrushTool, SphericalBrushTool, CorrectionScissorsTool];

  const { UIDialogService, MeasurementService } = servicesManager.services;
  console.log('---------- --------- ------- --------')
  console.log(MeasurementService)
  tools.forEach(tool => csTools.addTool(tool));

  csTools.addTool(BrushTool, {
    name: 'BrushEraser',
    configuration: {
      alwaysEraseOnClick: true,
    },
  });




  cornerstone.events.addEventListener(
    cornerstone.EVENTS.ELEMENT_ENABLED,
    event => {
      console.log('00000000000000000000000000000000000000', event)

    });
}
