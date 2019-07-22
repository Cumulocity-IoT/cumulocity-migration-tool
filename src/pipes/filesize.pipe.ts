import {Pipe, PipeTransform} from "@angular/core";

@Pipe({name: 'fileSize'})
export class FileSizePipe implements PipeTransform {
    transform(value: number): string {
        switch(Math.floor(Math.log2(value)/10)) {
            case 0: {
                return value + ' B'
            }
            case 1: {
                return (value/Math.pow(2, 10)).toPrecision(3) + ' KiB'
            }
            case 2: {
                return (value/Math.pow(2, 20)).toPrecision(3) + ' MiB'
            }
            default: {
                return (value/Math.pow(2, 30)).toPrecision(3) + ' GiB'
            }
        }
    }
}