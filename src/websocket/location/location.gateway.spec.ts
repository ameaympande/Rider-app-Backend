import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../auth/auth.service';
import { RidesService } from '../../rides/rides.service';
import { TrackingService } from '../../tracking/tracking.service';
import { LocationGateway } from './location.gateway';

describe('LocationGateway', () => {
  let gateway: LocationGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationGateway,
        {
          provide: AuthService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: RidesService,
          useValue: {
            assertMember: jest.fn(),
          },
        },
        {
          provide: TrackingService,
          useValue: {
            saveLocation: jest.fn(),
          },
        },
        {
          provide: require('../../users/users.service').UsersService,
          useValue: {
            updatePresence: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<LocationGateway>(LocationGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
