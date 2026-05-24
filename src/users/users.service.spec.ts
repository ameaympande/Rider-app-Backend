import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../schemas/user.schema';
import { Bike } from '../schemas/bike.schema';
import { RideRoom } from '../schemas/ride-room.schema';
import { RideHistory } from '../schemas/ride-history.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(Bike.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            deleteOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(RideRoom.name),
          useValue: {
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(RideHistory.name),
          useValue: {
            countDocuments: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
