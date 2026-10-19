export type ReservationStatus =
    | "ENVIADA_PARA_ANALISE"
    | "REPROVADA"
    | "APROVADA"
    | "FINALIZADA"
    | "CANCELADA";

export type VehicleType =
    | "CARRO"
    | "VAN";

export type Reservation = MeetingRoom | Auditorium | FleetVehicle;

export interface BaseReservation {
    id: number;
    status: ReservationStatus;
    reservationDate: string;
    dateAnalysis: string | null;
    reasonFailure: string | null;
    userNameRequester: string;
    requesterDepartment: string | null;
    userNameApprover: string | null;
    dateCreate: string;
    dateCancellation: string | null;
    reasonsCancellation: string | null;
}

export interface MeetingRoom extends BaseReservation {
    room: Room;
    reservationType: "MEETING_ROOM";
    startTime: string;
    endTime: string;
    reasonOutsideHours: string | null;
    numPeople: number;
    coffee: boolean;
    reasonCoffee: string | null;
    isApproveCoffee: boolean | null;
    reasonRejectCoffee: string | null;
    observation: string;
    telephone: string | null;
}

export interface Room {
    id: number;
    floor: string;
}

export interface CreateMeetingRoom {
    reservationDate: string;
    roomId: number;
    startTime: string;
    userNameRequester: string;
    requesterDepartment: string;
    endTime: string;
    reasonOutsideHours: string;
    numPeople: number;
    isCoffee: boolean;
    reasonCoffee: string;
    observation: string;
    userId: number | null;
    telephone: string;
}

export interface Auditorium extends BaseReservation {
    timeOpenAuditorium: string;
    reasonOpenAuditorium: string | null;
    reason: string;
    reservationType: "AUDITORIUM";
    startTime: string;
    endTime: string;
    reasonOutsideHours: string | null;
    numPeople: number;
    externalPublic: boolean;
    necessaryScreen: boolean;
    necessarySoundSystem: boolean;
    coffeeBreak: CoffeeBreak | null;
    observation: string;
    numExternalPeople: number | null;
    telephone: string | null;
}

export interface CoffeeBreak {
    necessaryCoffee: boolean;
    reasonCoffee: string | null;
    foodSetupTime: string | null;
    serviceTime: string | null;
    isApproveCoffeeBreak: boolean | null;
    reasonRejectCoffee: string | null;
}

export interface CreateAuditorium {
    reservationDate: string;
    timeOpenAuditorium: string;
    reasonOpenAuditorium: string;
    reason: string;
    startTime: string;
    endTime: string;
    reasonOutsideHours: string;
    userNameRequester: string;
    requesterDepartment: string;
    numPeople: number;
    externalPublic: boolean;
    necessaryScreen: boolean;
    necessarySoundSystem: boolean;
    necessaryCoffee: boolean;
    foodSetupTime: string | null;
    serviceTime: string | null;
    reasonCoffee: string;
    observation: string;
    userId: number | null;
    telephone: string;
    numExternalPeople: number;
}

export interface FleetVehicle extends BaseReservation {
    exitTime: string;
    reason: string;
    reservationType: "FLEET_VEHICLE";
    departureAddress: string;
    destinationAddress: string;
    isOutsideTheMunicipality: boolean;
    reasonOutsideTheMunicipality: string | null;
    driver: Driver | null;
    necessaryReturn: boolean;
    returnTime: string | null;
    departureAddressReturn: string | null;
    destinationAddressReturn: string | null;
    contact: string;
    necessaryVan: boolean;
    reasonUseVan: string | null;
    typeVehicle: VehicleType;
    quantityPassengers: number;
    telephone: string | null;
}

export interface Driver {
    id: number;
    name: string;
    img: string;
}

export interface CreateFleetVehicle {
    reservationDate: string;
    exitTime: string;
    reason: string;
    departureAddress: string;
    destinationAddress: string;
    isOutsideTheMunicipality: boolean;
    reasonOutsideTheMunicipality: string | null;
    necessaryReturn: boolean;
    returnTime: string | null;
    departureAddressReturn: string | null;
    destinationAddressReturn: string | null;
    contact: string;
    userNameRequester: string;
    requesterDepartment: string;
    necessaryVan: boolean;
    reasonUseVan: string | null;
    typeVehicle: VehicleType;
    quantityPassengers: number;
    userId: number | null;
    telephone: string;
}
