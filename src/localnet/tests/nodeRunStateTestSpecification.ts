



export interface NodeRunStateTestSpecificationEntry {

    states: boolean[]
    // ms second sleep after this state switch
    sleep?: number
}

export interface NodeRunStateTestSpecification {

    entries: NodeRunStateTestSpecificationEntry[];


}
