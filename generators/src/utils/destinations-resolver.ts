import {join, relative} from "path";
import {InterpolatedYaml} from "./interpolate-yaml";
import {exists} from "./fs-exists";
import {interpolate} from "./interpolator";

interface IDestinationsResolverOptions {
    projectRoot: string;
    templates: Map<string, string>;
    config: InterpolatedYaml;
    inputs: Record<string, unknown>;
    blueprintPath: string;
}

export const resolveDestinations = async (options: IDestinationsResolverOptions): Promise<Map<string, string>> => {
    const destinations = new Map<string, string>();
    await Promise.all(Array.from(options.templates.keys()).map(async (template) => {
        let destination = join(
          options.projectRoot,
          options.config.destination,
          relative(join(options.blueprintPath, 'templates'), template),
        );
        destination = destination.substring(0, destination.length - '.ejs'.length);
        destination = interpolate(destination, options.inputs);
        if (await exists(destination)) {
            throw new Error(`ECONFLICT: File ${destination} already exists`);
        }
        destinations.set(template, destination);
    }));
    return destinations;
};
