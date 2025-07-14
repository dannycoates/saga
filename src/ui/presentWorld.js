/**
 * Present world using the modern architecture
 * This works with the World class that uses SimulationBackend and DisplayManager
 */
export function presentWorld(worldElem, world) {
  // Clear existing content
  worldElem.replaceChildren();

  // Initialize displays with the world element
  world.initializeDisplays(worldElem);

  // Set world height based on floor count
  const floorCount = world.floors.size;
  worldElem.style.height = world.floorHeight * floorCount + "px";

  // Create floor components
  let index = 0;
  world.floors.forEach((floorDisplay, floorLevel) => {
    const floorComponent = document.createElement("elevator-floor");
    floorComponent.floor = floorDisplay;

    // Handle first and last floor button visibility
    if (index === 0) {
      floorComponent.setAttribute("hide-down", "true");
    }
    if (index === floorCount - 1) {
      floorComponent.setAttribute("hide-up", "true");
    }

    worldElem.appendChild(floorComponent);
    index++;
  });

  // Create elevator components
  world.elevators.forEach((elevatorDisplay, elevatorIndex) => {
    const elevatorComponent = document.createElement("elevator-car");
    elevatorComponent.elevator = elevatorDisplay;
    worldElem.appendChild(elevatorComponent);
  });

  // Setup passenger creation handler
  const newPassengerHandler = (event) => {
    const passengerDisplay = event.detail;
    const passengerComponent = document.createElement("elevator-passenger");
    passengerComponent.passenger = passengerDisplay;
    worldElem.appendChild(passengerComponent);
  };
  
  world.addEventListener("new_passenger", newPassengerHandler);

  // Return cleanup function
  return {
    worldElem,
    world,
    cleanup: () => {
      world.removeEventListener("new_passenger", newPassengerHandler);
    },
  };
}