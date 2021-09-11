export default function refreshViewports() {
  try {
    cornerstone.getEnabledElements().forEach(enabledElement => {
      cornerstone.updateImage(enabledElement.element);
    });
  } catch (error) {
    console.log(error)
  }

}
