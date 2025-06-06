import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { headers, headersId } from './headers';
import type { node, nodeId } from './node';

export interface available_eventAttributes {
  node: any;
  block: number;
  became_available?: boolean;
}

export type available_eventPk = "node" | "block";
export type available_eventId = available_event[available_eventPk];
export type available_eventOptionalAttributes = "became_available";
export type available_eventCreationAttributes = Optional<available_eventAttributes, available_eventOptionalAttributes>;

export class available_event extends Model<available_eventAttributes, available_eventCreationAttributes> implements available_eventAttributes {
  node!: any;
  block!: number;
  became_available?: boolean;

  // available_event belongsTo headers via block
  block_header!: headers;
  getBlock_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setBlock_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createBlock_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // available_event belongsTo node via node
  node_node!: node;
  getNode_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setNode_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createNode_node!: Sequelize.BelongsToCreateAssociationMixin<node>;

  static initModel(sequelize: Sequelize.Sequelize): typeof available_event {
    return available_event.init({
    node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    },
    block: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    became_available: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'available_event',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pk_available_event",
        unique: true,
        fields: [
          { name: "node" },
          { name: "block" },
        ]
      },
    ]
  });
  }
}
